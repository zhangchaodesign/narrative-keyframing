import type { NarrativeEventData } from "@/lib/types/narrative";
import type { TimelineItem } from "@/lib/types/timeline";
import type { NarrativeNodeType, WorkflowNode } from "@/lib/types/workflow";

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

type SetNodesFn = (updater: (nodes: WorkflowNode[]) => WorkflowNode[]) => void;

type NarrativeGenerationResponse = {
  narratives?: Array<{
    narrativeNodeId: string;
    narration?: string;
    snippetUsages?: Array<{
      originalSnippet: string;
      verbatimInNarrative: string;
    }>;
  }>;
};

type RegenerateNarrativesParams = {
  events: NarrativeEventData[];
  setNodes: SetNodesFn;
  customPrompt?: string;
};

export const generateNarratives = async ({
  events,
  setNodes,
  customPrompt,
}: RegenerateNarrativesParams): Promise<NarrativeGenerationResponse> => {
  // console.log("Regenerating narratives for events:", events);

  const narrativeNodeIds = new Set(
    events.map((event) => event.narrativeNodeId).filter(Boolean),
  );

  if (narrativeNodeIds.size === 0) {
    return { narratives: [] };
  }

  const updateNodeLoadingState = (isLoading: boolean) =>
    setNodes((nodesState) =>
      nodesState.map((node) => {
        if (node.type === "narrative" && narrativeNodeIds.has(node.id)) {
          return {
            ...node,
            data: {
              ...node.data,
              isLoading,
            },
          };
        }
        return node;
      }),
    );

  updateNodeLoadingState(true);

  try {
    const trimmedPrompt = customPrompt?.trim();

    const response = await fetch("/api/generate-narrative", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        events,
        customPrompt: trimmedPrompt ? trimmedPrompt : undefined,
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to generate narrative");
    }

    const data = (await response.json()) as NarrativeGenerationResponse;

    setNodes((nodesState) =>
      nodesState.map((node) => {
        if (node.type === "narrative" && narrativeNodeIds.has(node.id)) {
          const narrativeForNode = data.narratives?.find(
            (n) => n.narrativeNodeId === node.id,
          );

          return {
            ...node,
            data: {
              ...node.data,
              narration:
                narrativeForNode?.narration ?? node.data?.narration ?? "",
              snippetUsages: narrativeForNode?.snippetUsages ?? [],
              isLoading: false,
            },
          };
        }
        return node;
      }),
    );

    return data;
  } catch (error) {
    updateNodeLoadingState(false);
    throw error;
  }
};
