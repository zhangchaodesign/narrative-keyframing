import type { PerspectiveNodeType, WorkflowNode } from "@/lib/types/workflow";
import {
  type CharacterEvidenceResult,
  type EvidenceAnalysisResponse,
  type GeneratePerspectiveResponse,
  type PerspectiveEvidenceTarget,
  type PerspectivePreparationResult,
} from "@/lib/types/perspective";

const NEED_REFLECTION_MESSAGE = "Add a perspective to analyze evidence.";
const ANALYZING_EVIDENCE_MESSAGE = "Analyzing evidence...";
const ANALYSIS_FAILED_MESSAGE = "Evidence analysis failed. Try again.";
const NO_CHARACTERS_MESSAGE = "No characters available to analyze.";
const NO_EVIDENCE_FOUND_MESSAGE = "No supporting evidence found.";

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
  target: PerspectiveEvidenceTarget | null,
): Promise<{
  success: boolean;
  evidence: CharacterEvidenceResult[];
  message: string;
}> {
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
  targets: Array<{
    nodeId: string;
    target: PerspectiveEvidenceTarget;
  }>,
): Promise<
  Array<{
    nodeId: string;
    success: boolean;
    evidence: CharacterEvidenceResult[];
    message: string;
  }>
> {
  if (targets.length === 0) {
    return [];
  }

  const analysisPromises = targets.map(
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
 * @param preparation Pre-computed event/task payload from the workflow store
 * @returns Map of node IDs to generated reflection text
 */
export async function generateMultiplePerspectives(
  preparation: PerspectivePreparationResult | null,
  customPrompt?: string,
): Promise<Map<string, string>> {
  if (!preparation) {
    throw new Error("Failed to prepare perspective request");
  }

  console.log("Generating perspectives for tasks:", preparation.tasks);

  const { eventSequence, tasks } = preparation;

  const trimmedPrompt = customPrompt?.trim();

  const results = await Promise.all(
    tasks.map(async (task) => {
      const response = await fetch("/api/generate-perspective", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          eventSequence,
          perspectives: [task],
          customPrompt: trimmedPrompt ? trimmedPrompt : undefined,
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
      const reflection = data?.perspectives?.[0]?.reflection ?? "";
      return [task.id, reflection] as const;
    }),
  );

  return new Map<string, string>(results);
}

/**
 * Regenerate a single perspective, optionally providing sibling content.
 * @param preparation Pre-computed event/task payload for the target node
 * @param previousPerspective Optional text of the previous sibling
 * @param nextPerspective Optional text of the next sibling
 * @returns Newly generated reflection string
 */
export async function regenerateSinglePerspective({
  preparation,
  previousPerspective,
  nextPerspective,
  customPrompt,
}: {
  preparation: PerspectivePreparationResult | null;
  previousPerspective?: string;
  nextPerspective?: string;
  customPrompt?: string;
}): Promise<string> {
  if (!preparation || preparation.tasks.length === 0) {
    throw new Error("No perspective task found for node");
  }

  const regenerateTask = preparation.tasks[0];
  const trimmedPrompt = customPrompt?.trim();
  const contextualNotes = [
    previousPerspective?.trim()
      ? `Previous sibling perspective (context only):\n${previousPerspective.trim()}`
      : null,
    nextPerspective?.trim()
      ? `Next sibling perspective (context only):\n${nextPerspective.trim()}`
      : null,
  ].filter((note): note is string => Boolean(note));

  const combinedPrompt = [trimmedPrompt, ...contextualNotes]
    .filter((note): note is string => Boolean(note && note.length > 0))
    .join("\n\n");

  const response = await fetch("/api/generate-perspective", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      eventSequence: preparation.eventSequence,
      perspectives: [regenerateTask],
      customPrompt: combinedPrompt.length > 0 ? combinedPrompt : undefined,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    const errorMessage =
      (errorBody && errorBody.error) ||
      `Failed to regenerate perspective (${response.status}).`;
    throw new Error(errorMessage);
  }

  const data = (await response.json()) as GeneratePerspectiveResponse;
  return data?.perspectives?.[0]?.reflection ?? "";
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
    evidence: CharacterEvidenceResult[];
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
