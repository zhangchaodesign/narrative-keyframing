import type {
  CharacterNodeType,
  CharacterTraits,
  EventNodeType,
  PerspectiveNodeType,
  WorkflowEdge,
  WorkflowNode,
} from "@/lib/types/workflow";
import { sortEventsByTimeline } from "@/lib/utiils/workflowUtils";

// =============================================================================
// STATUS MESSAGES
// =============================================================================

const NEED_REFLECTION_MESSAGE = "Add a reflection to analyze evidence.";
const ANALYZING_EVIDENCE_MESSAGE = "Analyzing evidence...";
const ANALYSIS_FAILED_MESSAGE = "Evidence analysis failed. Try again.";
const NO_CHARACTERS_MESSAGE = "No characters available to analyze.";
const NO_EVIDENCE_FOUND_MESSAGE = "No supporting evidence found.";

// =============================================================================
// EVIDENCE CONSTANTS & TYPES
// =============================================================================

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

// =============================================================================
// PERSPECTIVE GENERATION TYPES
// =============================================================================

export type CharacterSnapshotPayload = {
  name: string;
  traits: {
    physiology: string[];
    psychology: string[];
    sociology: string[];
  };
};

export type PerspectiveTaskPayload = {
  id: string;
  narrator: string;
  eventLabel: string;
  eventObjective: string;
  characterSnapshots: CharacterSnapshotPayload[];
};

export type GeneratePerspectiveResponse = {
  perspectives: Array<{
    reflection: string;
  }>;
};

export type GenerateSinglePerspectiveResponse = {
  reflection: string;
};

export type PerspectivePreparationResult = {
  eventSequence: Array<{
    label: string;
    description: string;
  }>;
  tasks: PerspectiveTaskPayload[];
};

type PositionedCharacterSnapshot = CharacterSnapshotPayload & {
  positionX: number;
};

// =============================================================================
// INTERNAL HELPERS - EVIDENCE ANALYSIS
// =============================================================================

/**
 * Normalize character traits into attribute payloads for evidence analysis.
 * @param traits Raw trait data stored on the character node
 * @returns Array of trait/value payloads filtered for empty values
 */
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

/**
 * Build the API target payload for an evidence run.
 * @param node Perspective node under analysis
 * @param characters Characters connected to the perspective
 * @param groupContext Contextual text for the perspective group
 * @returns Structured target for /api/extract-evidence
 */
const buildEvidenceTarget = ({
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

/**
 * Collect characters connected to a perspective node via workflow edges.
 * @param perspectiveId Perspective node identifier
 * @param edges Workflow edges describing relationships
 * @param characterMap Map of character nodes by ID
 * @returns Array of connected characters with normalized attributes
 */
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

/**
 * Build a context paragraph from sibling perspectives in the same group.
 * @param perspective Perspective node being analyzed
 * @param allPerspectives List of all perspective nodes
 * @returns Combined sibling reflections to provide larger context
 */
const buildGroupContext = (
  perspective: PerspectiveNodeType,
  allPerspectives: PerspectiveNodeType[],
): string => {
  const parentId = perspective.parentId;
  if (!parentId) {
    return "";
  }

  return allPerspectives
    .filter((sibling) => sibling.parentId === parentId)
    .sort((a, b) => a.position.x - b.position.x || a.position.y - b.position.y)
    .map((sibling) => (sibling.data?.reflection ?? "").trim())
    .filter((reflection) => reflection.length > 0)
    .join("\n\n");
};

/**
 * Find the nearest neighbor perspective that has connected characters.
 * @param startPerspectiveId ID of the perspective that lacks characters
 * @param direction Whether to look "previous" or "next" within the group chain
 * @param edges Workflow edges describing perspective connections
 * @param perspectiveMap Quick lookup table for perspectives by ID
 * @param characterMap Quick lookup table for character nodes by ID
 * @returns Neighbor perspective details or null if none found
 */
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

// =============================================================================
// PUBLIC API - PREPARATION HELPERS
// =============================================================================

/**
 * Prepare payload for analyzing a single perspective's evidence requirements.
 * @param perspectiveId Perspective node identifier
 * @param nodes All workflow nodes in the canvas
 * @param edges Workflow edges for relationships
 * @returns Evidence request payload or null when requirements are missing
 */
export const prepareEvidenceAnalysis = ({
  perspectiveId,
  nodes,
  edges,
}: {
  perspectiveId: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}): EvidenceAnalysisRequest => {
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

  const targetPerspective = perspectiveMap.get(perspectiveId);
  if (!targetPerspective) {
    return null;
  }

  const groupContext = buildGroupContext(targetPerspective, perspectiveNodes);

  const primaryCharacters = getCharactersForPerspective({
    perspectiveId,
    edges,
    characterMap,
  });

  if (primaryCharacters.length > 0) {
    return buildEvidenceTarget({
      node: targetPerspective,
      characters: primaryCharacters,
      groupContext,
    });
  }

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

  if (fallbackCharacters.length === 0) {
    return null;
  }

  return buildEvidenceTarget({
    node: targetPerspective,
    characters: fallbackCharacters,
    groupContext,
  });
};

/**
 * Build perspective generation tasks for the given target nodes.
 * @param nodes All workflow nodes in the canvas
 * @param edges Workflow edges (unused but kept for parity)
 * @param targetNodeIds Optional filter for perspective IDs
 * @returns Event context plus ordered task payloads or null when invalid
 */
export const preparePerspectiveRequest = ({
  nodes,
  targetNodeIds,
}: {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  targetNodeIds?: string[];
}): PerspectivePreparationResult | null => {
  const eventNodes = nodes.filter(
    (node): node is EventNodeType => node.type === "event",
  );
  const perspectiveNodes = nodes.filter(
    (node): node is PerspectiveNodeType => node.type === "perspective",
  );
  const characterNodes = nodes.filter(
    (node): node is CharacterNodeType => node.type === "character",
  );

  const sortedEventNodes = sortEventsByTimeline(eventNodes);

  const eventNodeMap = new Map(
    sortedEventNodes.map((eventNode) => [eventNode.id, eventNode]),
  );
  const eventOrderMap = new Map(
    sortedEventNodes.map((eventNode, indexPosition) => [
      eventNode.id,
      indexPosition,
    ]),
  );

  const eventSequence = sortedEventNodes.map((eventNode) => {
    const timeline = eventNode.data?.timeline?.trim();
    const description = eventNode.data?.description?.trim();
    const safeDescription =
      description && description.length > 0
        ? description
        : "No description provided.";

    const label =
      timeline && timeline.length > 0
        ? timeline
        : description && description.length > 0
        ? description
        : eventNode.id;

    return {
      label,
      description: safeDescription,
    };
  });

  const targetIdSet =
    targetNodeIds && targetNodeIds.length > 0 ? new Set(targetNodeIds) : null;

  const relevantPerspectiveNodes = targetIdSet
    ? perspectiveNodes.filter((node) => targetIdSet.has(node.id))
    : perspectiveNodes;

  const tasksWithOrdering = relevantPerspectiveNodes
    .map((perspectiveNode) => {
      const eventId = perspectiveNode.data?.eventId?.trim();
      const eventNode = eventId ? eventNodeMap.get(eventId) ?? null : null;
      if (!eventNode) {
        return null;
      }

      const eventOrder =
        eventOrderMap.get(eventNode.id) ?? Number.MAX_SAFE_INTEGER;

      const eventLabel =
        eventNode.data?.timeline?.trim() ||
        eventNode.data?.description?.trim() ||
        eventNode.id;
      const rawObjective = eventNode.data?.description?.trim();
      const eventObjective =
        rawObjective && rawObjective.length > 0
          ? rawObjective
          : `Describe what happens during ${eventLabel}.`;

      const fallbackNarratorName =
        perspectiveNode.data?.narrator?.trim() || "Narrator";

      const characterSnapshotsWithPosition: PositionedCharacterSnapshot[] =
        characterNodes
          .filter((characterNode) => {
            const assignedPerspectiveId =
              characterNode.data?.perspectiveId?.trim() ?? "";
            return assignedPerspectiveId === perspectiveNode.id;
          })
          .map((characterNode) => {
            const name = characterNode.data?.name?.trim() || characterNode.id;
            const traits = characterNode.data?.traits ?? {
              physiology: [],
              psychology: [],
              sociology: [],
            };

            return {
              name,
              positionX: characterNode.position.x,
              traits: {
                physiology: traits.physiology ?? [],
                psychology: traits.psychology ?? [],
                sociology: traits.sociology ?? [],
              },
            };
          });

      let characterSnapshots: CharacterSnapshotPayload[] =
        characterSnapshotsWithPosition
          .sort((a, b) => a.positionX - b.positionX)
          .map((snapshot) => {
            const { positionX: _ignore, ...rest } = snapshot;
            return rest;
          });

      if (characterSnapshots.length === 0) {
        characterSnapshots = [
          {
            name: fallbackNarratorName,
            traits: {
              physiology: [],
              psychology: [],
              sociology: [],
            },
          },
        ];
      }

      const narratorName = characterSnapshots[0]?.name || fallbackNarratorName;

      const payload: PerspectiveTaskPayload = {
        id: perspectiveNode.id,
        narrator: narratorName,
        eventLabel,
        eventObjective,
        characterSnapshots,
      };

      return {
        order: eventOrder,
        secondaryOrder: perspectiveNode.position.x,
        task: payload,
      };
    })
    .filter(
      (
        entry,
      ): entry is {
        order: number;
        secondaryOrder: number;
        task: PerspectiveTaskPayload;
      } => entry != null,
    );

  if (tasksWithOrdering.length === 0) {
    return null;
  }

  const tasks = tasksWithOrdering
    .sort((a, b) => {
      if (a.order !== b.order) {
        return a.order - b.order;
      }
      if (a.secondaryOrder !== b.secondaryOrder) {
        return a.secondaryOrder - b.secondaryOrder;
      }
      return a.task.id.localeCompare(b.task.id);
    })
    .map((entry) => entry.task);

  return {
    eventSequence,
    tasks,
  };
};

// =============================================================================
// PERSPECTIVE ACTIONS
// =============================================================================

/**
 * Apply a partial data patch to a single perspective node within the node array.
 * @param nodes All workflow nodes
 * @param nodeId Perspective node identifier
 * @param patch Partial data patch for the node
 * @returns Updated list of workflow nodes
 */
export function updatePerspectiveAnalysisState(
  nodes: WorkflowNode[],
  nodeId: string,
  patch: Partial<PerspectiveNodeType["data"]>,
): WorkflowNode[] {
  return nodes.map((node) => {
    if (node.id !== nodeId || node.type !== "perspective") {
      return node;
    }
    const existingData = node.data as PerspectiveNodeType["data"];
    return {
      ...node,
      data: {
        ...existingData,
        ...patch,
      },
    };
  });
}

/**
 * Call the evidence API for a single perspective node and normalize the response.
 * @param perspectiveId Perspective node identifier
 * @param nodes Collection of workflow nodes
 * @param edges Workflow edges describing graph relationships
 * @returns Result payload including success flag, evidence, and status message
 */
export async function analyzeSinglePerspectiveEvidence(
  perspectiveId: string,
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
): Promise<{
  success: boolean;
  evidence: any[];
  message: string;
}> {
  const target = prepareEvidenceAnalysis({
    perspectiveId,
    nodes,
    edges,
  });

  if (!target) {
    return {
      success: false,
      evidence: [],
      message: NO_CHARACTERS_MESSAGE,
    };
  }

  if (!target.reflection.trim()) {
    return {
      success: false,
      evidence: [],
      message: NEED_REFLECTION_MESSAGE,
    };
  }

  const hasCharacterAttributes = target.characters.some((character) =>
    character.attributes.some((attribute) => attribute.value.trim().length > 0),
  );

  if (!hasCharacterAttributes) {
    return {
      success: false,
      evidence: [],
      message: NO_CHARACTERS_MESSAGE,
    };
  }

  try {
    const response = await fetch("/api/extract-evidence", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(target),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => null);
      const errorMessage =
        (errorBody && errorBody.error) ||
        `Failed to analyze evidence (${response.status}).`;
      throw new Error(errorMessage);
    }

    const data = (await response.json()) as EvidenceAnalysisResponse | null;
    const evidence = data?.characterEvidence ?? [];
    const supportedCharacters = evidence.filter(
      (entry) => entry.items.length > 0,
    );
    const uniqueCharacterNames = [
      ...new Set(supportedCharacters.map((entry) => entry.characterName)),
    ];
    const successMessage =
      uniqueCharacterNames.length > 0
        ? uniqueCharacterNames
            .map((name) => `Found evidence for ${name}`)
            .join(", ")
        : NO_EVIDENCE_FOUND_MESSAGE;

    return {
      success: true,
      evidence,
      message: successMessage,
    };
  } catch (error) {
    console.error("Error analyzing character evidence:", error);
    return {
      success: false,
      evidence: [],
      message: ANALYSIS_FAILED_MESSAGE,
    };
  }
}

/**
 * Batch evidence analysis for multiple perspective nodes concurrently.
 * @param perspectiveNodeIds Perspective IDs to analyze
 * @param nodes All workflow nodes
 * @param edges Workflow edges
 * @returns Array of per-node success payloads once all requests finish
 */
export async function analyzeMultiplePerspectivesEvidence(
  perspectiveNodeIds: string[],
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
): Promise<
  Array<{
    nodeId: string;
    success: boolean;
    evidence: any[];
    message: string;
  }>
> {
  const analysisTargets = perspectiveNodeIds
    .map((perspectiveId) => {
      const perspectiveNode = nodes.find(
        (node): node is PerspectiveNodeType =>
          node.id === perspectiveId && node.type === "perspective",
      );

      if (!perspectiveNode) {
        return null;
      }

      const perspectiveData =
        perspectiveNode.data as PerspectiveNodeType["data"];

      if (
        !perspectiveData?.reflection?.trim() ||
        perspectiveData?.isAnalyzingEvidence
      ) {
        return null;
      }

      const target = prepareEvidenceAnalysis({
        perspectiveId,
        nodes,
        edges,
      });

      if (!target || !target.reflection.trim()) {
        return null;
      }

      const hasCharacterAttributes = target.characters.some((character) =>
        character.attributes.some(
          (attribute) => attribute.value.trim().length > 0,
        ),
      );

      if (!hasCharacterAttributes) {
        return null;
      }

      return {
        nodeId: perspectiveId,
        target,
      };
    })
    .filter((item): item is { nodeId: string; target: any } => item !== null);

  if (analysisTargets.length === 0) {
    return [];
  }

  const analysisPromises = analysisTargets.map(
    async ({ nodeId: perspectiveNodeId, target }) => {
      try {
        const response = await fetch("/api/extract-evidence", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(target),
        });

        if (!response.ok) {
          throw new Error(`Failed to analyze evidence (${response.status}).`);
        }

        const data = (await response.json()) as EvidenceAnalysisResponse | null;
        const evidence = data?.characterEvidence ?? [];
        const supportedCharacters = evidence.filter(
          (entry) => entry.items.length > 0,
        );
        const uniqueCharacterNames = [
          ...new Set(supportedCharacters.map((entry) => entry.characterName)),
        ];
        const successMessage =
          uniqueCharacterNames.length > 0
            ? uniqueCharacterNames
                .map((name) => `Found evidence for ${name}`)
                .join(", ")
            : NO_EVIDENCE_FOUND_MESSAGE;

        return {
          nodeId: perspectiveNodeId,
          success: true,
          evidence,
          message: successMessage,
        };
      } catch (error) {
        console.error(
          `Error analyzing evidence for ${perspectiveNodeId}:`,
          error,
        );
        return {
          nodeId: perspectiveNodeId,
          success: false,
          evidence: [],
          message: ANALYSIS_FAILED_MESSAGE,
        };
      }
    },
  );

  return Promise.all(analysisPromises);
}

/**
 * Call the generation API for multiple perspective nodes, returning text updates.
 * @param targetNodeIds Perspective IDs to generate
 * @param nodes All workflow nodes
 * @param edges Workflow edges
 * @returns Map of node IDs to generated reflection text
 */
export async function generateMultiplePerspectives(
  targetNodeIds: string[],
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
): Promise<Map<string, string>> {
  const preparation = preparePerspectiveRequest({
    nodes,
    edges,
    targetNodeIds,
  });

  if (!preparation) {
    throw new Error("Failed to prepare perspective request");
  }

  const { eventSequence, tasks } = preparation;

  const response = await fetch("/api/generate-perspective", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      eventSequence,
      perspectives: tasks,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    const errorMessage =
      (errorBody && errorBody.error) ||
      `Failed to generate perspectives (${response.status}).`;
    throw new Error(errorMessage);
  }

  const data = (await response.json()) as GeneratePerspectiveResponse;
  const perspectives = data?.perspectives ?? [];

  const orderedUpdates = perspectives
    .map((item, index) => {
      const task = tasks[index];
      if (!task) {
        return null;
      }
      return [task.id, item.reflection] as const;
    })
    .filter((entry): entry is readonly [string, string] => entry != null);

  return new Map<string, string>(orderedUpdates);
}

/**
 * Regenerate a single perspective, optionally providing sibling content.
 * @param nodeId Perspective node identifier
 * @param nodes All workflow nodes
 * @param edges Workflow edges
 * @returns Newly generated reflection string
 */
export async function regenerateSinglePerspective(
  nodeId: string,
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
): Promise<string> {
  const preparation = preparePerspectiveRequest({
    nodes,
    edges,
    targetNodeIds: [nodeId],
  });

  if (!preparation || preparation.tasks.length === 0) {
    throw new Error("No perspective task found for node");
  }

  const regenerateTask = preparation.tasks[0];
  const targetPerspectiveNode = nodes.find(
    (node): node is PerspectiveNodeType =>
      node.id === nodeId && node.type === "perspective",
  );

  let previousPerspective: string | undefined;
  let nextPerspective: string | undefined;

  if (targetPerspectiveNode) {
    const siblings = nodes.filter(
      (node): node is PerspectiveNodeType =>
        node.type === "perspective" &&
        node.parentId === targetPerspectiveNode.parentId,
    );
    const sortedSiblings = [...siblings].sort(
      (a, b) => a.position.x - b.position.x || a.position.y - b.position.y,
    );
    const currentIndex = sortedSiblings.findIndex((node) => node.id === nodeId);

    if (currentIndex > 0) {
      const content = (
        sortedSiblings[currentIndex - 1].data?.reflection ?? ""
      ).trim();
      previousPerspective = content.length > 0 ? content : undefined;
    }
    if (currentIndex >= 0 && currentIndex < sortedSiblings.length - 1) {
      const content = (
        sortedSiblings[currentIndex + 1].data?.reflection ?? ""
      ).trim();
      nextPerspective = content.length > 0 ? content : undefined;
    }
  }

  const response = await fetch("/api/update-perspective", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      perspective: regenerateTask,
      previousPerspective,
      nextPerspective,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    const errorMessage =
      (errorBody && errorBody.error) ||
      `Failed to regenerate perspective (${response.status}).`;
    throw new Error(errorMessage);
  }

  const data = (await response.json()) as GenerateSinglePerspectiveResponse;
  return data?.reflection ?? "";
}

/**
 * Apply analysis results from the evidence API back onto the workflow nodes.
 * @param nodes All workflow nodes
 * @param results Evidence results keyed by node ID
 * @returns Updated workflow nodes with analysis metadata
 */
export function applyAnalysisResults(
  nodes: WorkflowNode[],
  results: Array<{
    nodeId: string;
    success: boolean;
    evidence: any[];
    message: string;
  }>,
): WorkflowNode[] {
  return nodes.map((node) => {
    if (node.type !== "perspective") {
      return node;
    }

    const result = results.find((r) => r.nodeId === node.id);
    if (!result) {
      return node;
    }

    const existingData = node.data as PerspectiveNodeType["data"];
    return {
      ...node,
      data: {
        ...existingData,
        isAnalyzingEvidence: false,
        analysisStatus: result.success ? "success" : "error",
        analysisStatusMessage: result.message,
        analysisEvidence: result.evidence,
      },
    };
  });
}

/**
 * Set the loading state for selected perspective nodes.
 * @param nodes All workflow nodes
 * @param nodeIds Set of perspective IDs to toggle
 * @param isLoading Loading flag value
 * @returns Updated workflow nodes
 */
export function setPerspectivesLoading(
  nodes: WorkflowNode[],
  nodeIds: Set<string>,
  isLoading: boolean,
): WorkflowNode[] {
  return nodes.map((node) => {
    if (node.type !== "perspective") {
      return node;
    }

    if (!nodeIds.has(node.id)) {
      return node;
    }

    const existingData = node.data as PerspectiveNodeType["data"];
    return {
      ...node,
      data: {
        ...existingData,
        isLoading,
      },
    };
  });
}

/**
 * Toggle the evidence analysis state for a set of perspective nodes.
 * @param nodes All workflow nodes
 * @param nodeIds Perspective IDs to update
 * @param isAnalyzing Whether the nodes are currently analyzing
 * @returns Updated workflow nodes containing analysis flags
 */
export function setPerspectivesAnalyzing(
  nodes: WorkflowNode[],
  nodeIds: Set<string>,
  isAnalyzing: boolean,
): WorkflowNode[] {
  return nodes.map((node) => {
    if (node.type !== "perspective" || !nodeIds.has(node.id)) {
      return node;
    }
    const existingData = node.data as PerspectiveNodeType["data"];
    return {
      ...node,
      data: {
        ...existingData,
        isAnalyzingEvidence: isAnalyzing,
        analysisStatus: isAnalyzing ? "running" : "idle",
        analysisStatusMessage: isAnalyzing
          ? ANALYZING_EVIDENCE_MESSAGE
          : undefined,
      },
    };
  });
}

/**
 * Apply generated perspective reflections to workflow nodes after API calls.
 * @param nodes All workflow nodes
 * @param updateMap Map of node IDs to generated text
 * @returns Updated workflow nodes reflecting API output
 */
export function applyGeneratedPerspectives(
  nodes: WorkflowNode[],
  updateMap: Map<string, string>,
): WorkflowNode[] {
  return nodes.map((node) => {
    if (node.type === "perspective" && updateMap.has(node.id)) {
      const reflection = updateMap.get(node.id) ?? "";
      const existingData = node.data as PerspectiveNodeType["data"];
      const hasContent = reflection.trim().length > 0;
      return {
        ...node,
        data: {
          ...existingData,
          reflection,
          isAnalyzingEvidence: false,
          analysisStatus: "idle",
          analysisStatusMessage: hasContent
            ? undefined
            : NEED_REFLECTION_MESSAGE,
          analysisEvidence: hasContent ? [] : undefined,
        },
      };
    }
    return node;
  });
}

// =============================================================================
// EXPORTED CONSTANT MAP
// =============================================================================

export const PERSPECTIVE_MESSAGES = {
  NEED_REFLECTION: NEED_REFLECTION_MESSAGE,
  ANALYZING: ANALYZING_EVIDENCE_MESSAGE,
  FAILED: ANALYSIS_FAILED_MESSAGE,
  NO_CHARACTERS: NO_CHARACTERS_MESSAGE,
  NO_EVIDENCE: NO_EVIDENCE_FOUND_MESSAGE,
} as const;
