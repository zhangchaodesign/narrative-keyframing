import type {
  CharacterNodeType,
  CharacterTraits,
  PerspectiveNodeType,
  WorkflowEdge,
  WorkflowNode,
} from "@/lib/types/workflow";

export const TRAIT_CATEGORIES = [
  "physiology",
  "psychology",
  "sociology",
] as const;

export type TraitCategory = (typeof TRAIT_CATEGORIES)[number];

export const EVIDENCE_CATEGORIES = [
  "directDefinition",
  "actions",
  "speech",
  "appearance",
  "environment",
] as const;

export type EvidenceCategory = (typeof EVIDENCE_CATEGORIES)[number];

export const INDICATOR_DESCRIPTIONS: Record<EvidenceCategory, string> = {
  directDefinition:
    "Explicit direct statements or labels about the character (e.g., 'old man', 'tall woman', 'brave soldier')",
  actions:
    "Physical actions, behaviors, or body language (e.g., 'moved slowly', 'frowned', 'clenched his fists')",
  speech:
    "What the character says, how they speak, or how other characters say about them (e.g., 'shouted angrily', 'whispered softly')",
  appearance:
    "Visual descriptions of the character (e.g., 'gray hair', 'wrinkled skin', 'piercing blue eyes')",
  environment:
    "Surroundings, context, or setting that characterizes the person (e.g., 'in his mansion', 'wearing rags')",
};

export type CharacterAttributePayload = {
  traitCategory: TraitCategory;
  value: string;
};

export type CharacterEvidenceTarget = {
  characterId: string;
  characterName: string;
  attributes: CharacterAttributePayload[];
};

export type PerspectiveEvidenceTarget = {
  perspectiveId: string;
  reflection: string;
  characters: CharacterEvidenceTarget[];
  groupContext: string;
};

export type EvidenceAnalysisRequest = PerspectiveEvidenceTarget | null;

export type EvidenceItemResult = {
  text: string;
  category: EvidenceCategory;
  attributes: string[];
};

export type CharacterEvidenceResult = {
  characterId: string;
  characterName: string;
  items: EvidenceItemResult[];
};

export type EvidenceAnalysisResult = {
  characterEvidence: CharacterEvidenceResult[];
};

export type EvidenceAnalysisResponse = {
  perspectiveId: string;
  characterEvidence: CharacterEvidenceResult[];
};

const collectAttributes = (
  traits: CharacterTraits | undefined | null,
): CharacterAttributePayload[] => {
  if (!traits) {
    return [];
  }

  const entries: CharacterAttributePayload[] = [];
  for (const category of TRAIT_CATEGORIES) {
    const values = traits[category] ?? [];
    if (!Array.isArray(values)) {
      continue;
    }

    for (const rawValue of values) {
      const trimmed = typeof rawValue === "string" ? rawValue.trim() : "";
      if (!trimmed) {
        continue;
      }
      entries.push({
        traitCategory: category,
        value: trimmed,
      });
    }
  }

  return entries;
};

const buildTarget = ({
  node,
  characters,
  groupContext,
}: {
  node: PerspectiveNodeType;
  characters: CharacterEvidenceTarget[];
  groupContext: string;
}): PerspectiveEvidenceTarget => {
  const reflectionRaw = node.data?.reflection;
  const reflection = typeof reflectionRaw === "string" ? reflectionRaw : "";

  return {
    perspectiveId: node.id,
    reflection,
    characters,
    groupContext,
  };
};

const getCharactersForPerspective = ({
  perspectiveId,
  edges,
  characterMap,
}: {
  perspectiveId: string;
  edges: WorkflowEdge[];
  characterMap: Map<string, CharacterNodeType>;
}): CharacterEvidenceTarget[] => {
  const connectedCharacterIds = edges
    .filter(
      (edge) =>
        edge.target === perspectiveId && edge.targetHandle === "character",
    )
    .map((edge) => edge.source);

  if (connectedCharacterIds.length === 0) {
    return [];
  }

  const uniqueCharacterIds = Array.from(new Set(connectedCharacterIds));
  return uniqueCharacterIds
    .map((characterId) => characterMap.get(characterId))
    .filter((node): node is CharacterNodeType => Boolean(node))
    .map((characterNode) => {
      const rawName = characterNode.data?.name;
      const characterName =
        typeof rawName === "string" && rawName.trim().length > 0
          ? rawName.trim()
          : characterNode.id;

      const attributes = collectAttributes(characterNode.data?.traits);

      return {
        characterId: characterNode.id,
        characterName,
        attributes,
      };
    });
};

const findPerspectiveWithCharacters = ({
  startPerspectiveId,
  direction,
  edges,
  perspectiveMap,
  characterMap,
}: {
  startPerspectiveId: string;
  direction: "previous" | "next";
  edges: WorkflowEdge[];
  perspectiveMap: Map<string, PerspectiveNodeType>;
  characterMap: Map<string, CharacterNodeType>;
}): {
  node: PerspectiveNodeType;
  characters: CharacterEvidenceTarget[];
} | null => {
  const visited = new Set<string>([startPerspectiveId]);
  let currentId = startPerspectiveId;

  while (true) {
    const adjacentIds = edges
      .filter((edge) => {
        if (direction === "previous") {
          return (
            edge.target === currentId &&
            edge.targetHandle === "perspective-prev" &&
            typeof edge.source === "string"
          );
        }
        return (
          edge.source === currentId &&
          edge.sourceHandle === "perspective-next" &&
          typeof edge.target === "string"
        );
      })
      .map((edge) => (direction === "previous" ? edge.source : edge.target))
      .filter((candidateId): candidateId is string => Boolean(candidateId));

    if (adjacentIds.length === 0) {
      return null;
    }

    // Prioritize the first connected node; perspective chains are linear per group.
    const nextId = adjacentIds[0]!;
    if (visited.has(nextId)) {
      return null;
    }
    visited.add(nextId);

    const perspectiveNode = perspectiveMap.get(nextId);
    if (!perspectiveNode) {
      currentId = nextId;
      continue;
    }

    const characters = getCharactersForPerspective({
      perspectiveId: perspectiveNode.id,
      edges,
      characterMap,
    });
    if (characters.length > 0) {
      return {
        node: perspectiveNode,
        characters,
      };
    }

    currentId = perspectiveNode.id;
  }
};

export const prepareEvidenceAnalysis = ({
  perspectiveId,
  nodes,
  edges,
}: {
  perspectiveId: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}): EvidenceAnalysisRequest | null => {
  const perspectiveNodes = nodes.filter(
    (node): node is PerspectiveNodeType => node.type === "perspective",
  );
  const characterNodes = nodes.filter(
    (node): node is CharacterNodeType => node.type === "character",
  );

  const perspectiveMap = new Map(
    perspectiveNodes.map((node) => [node.id, node]),
  );
  const characterMap = new Map(characterNodes.map((node) => [node.id, node]));

  const buildGroupContext = (perspective: PerspectiveNodeType): string => {
    const parentId = perspective.parentId;
    if (!parentId) {
      return "";
    }

    return perspectiveNodes
      .filter((sibling) => sibling.parentId === parentId)
      .sort((a, b) => a.position.x - b.position.x || a.position.y - b.position.y)
      .map((sibling) => (sibling.data?.reflection ?? "").trim())
      .filter((reflection) => reflection.length > 0)
      .join("\n\n");
  };

  const targetPerspective = perspectiveMap.get(perspectiveId);
  if (!targetPerspective) {
    return null;
  }

  const primaryCharacters = getCharactersForPerspective({
    perspectiveId,
    edges,
    characterMap,
  });

  if (primaryCharacters.length > 0) {
    return buildTarget({
      node: targetPerspective,
      characters: primaryCharacters,
      groupContext: buildGroupContext(targetPerspective),
    });
  } else {
    const fallbackCharacters: CharacterEvidenceTarget[] = [];

    const previous = findPerspectiveWithCharacters({
      startPerspectiveId: perspectiveId,
      direction: "previous",
      edges,
      perspectiveMap,
      characterMap,
    });
    if (previous) {
      fallbackCharacters.push(...previous.characters);
    }

    const next = findPerspectiveWithCharacters({
      startPerspectiveId: perspectiveId,
      direction: "next",
      edges,
      perspectiveMap,
      characterMap,
    });
    if (next) {
      fallbackCharacters.push(...next.characters);
    }

    if (fallbackCharacters.length > 0) {
      return buildTarget({
        node: targetPerspective,
        characters: fallbackCharacters,
        groupContext: buildGroupContext(targetPerspective),
      });
    }
  }

  return null;
};
