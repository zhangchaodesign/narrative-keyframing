import type {
  PerspectiveNodeType,
  WorkflowNode,
  WorkflowEdge,
} from "@/lib/types/workflow";
import {
  preparePerspectiveRequest,
  type GeneratePerspectiveResponse,
  type GenerateSinglePerspectiveResponse,
} from "@/lib/workflow/workflowPerspective";
import {
  prepareEvidenceAnalysis,
  type EvidenceAnalysisResponse,
} from "@/lib/workflow/workflowEvidence";

// Constants
const NEED_REFLECTION_MESSAGE = "Add a reflection to analyze evidence.";
const ANALYZING_EVIDENCE_MESSAGE = "Analyzing evidence...";
const ANALYSIS_FAILED_MESSAGE = "Evidence analysis failed. Try again.";
const NO_CHARACTERS_MESSAGE = "No characters available to analyze.";
const NO_EVIDENCE_FOUND_MESSAGE = "No supporting evidence found.";

/**
 * Update analysis state for a single perspective node
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
 * Analyze evidence for a single perspective node
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
    character.attributes.some(
      (attribute) => attribute.value.trim().length > 0,
    ),
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
 * Analyze evidence for multiple perspective nodes in parallel
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
  // Prepare analysis targets for all valid perspective nodes
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

      // Skip if no reflection or already analyzing
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

  // Process all API calls in parallel
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
 * Generate perspectives for multiple nodes
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
 * Regenerate a single perspective node
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
 * Apply analysis results to nodes
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
 * Set loading state for perspective nodes
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
 * Set analyzing state for perspective nodes
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
        analysisStatusMessage: isAnalyzing ? ANALYZING_EVIDENCE_MESSAGE : undefined,
      },
    };
  });
}

/**
 * Apply generated perspectives to nodes
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

// Export constants for use in components
export const PERSPECTIVE_MESSAGES = {
  NEED_REFLECTION: NEED_REFLECTION_MESSAGE,
  ANALYZING: ANALYZING_EVIDENCE_MESSAGE,
  FAILED: ANALYSIS_FAILED_MESSAGE,
  NO_CHARACTERS: NO_CHARACTERS_MESSAGE,
  NO_EVIDENCE: NO_EVIDENCE_FOUND_MESSAGE,
} as const;
