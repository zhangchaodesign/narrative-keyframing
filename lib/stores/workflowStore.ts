import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  applyEdgeChanges,
  applyNodeChanges,
  type EdgeChange,
  type NodeChange,
} from "@xyflow/react";

import {
  initialEdges,
  initialNodes,
  type CharacterNodeType,
  type PerspectiveGroupNodeType,
  type PerspectiveNodeType,
  type WorkflowEdge,
  type WorkflowNode,
} from "@/components/WorkflowCanvas/workflow.constants";

type StateUpdater<T> = T | ((state: T) => T);

export const buildEvidenceAttributeKey = (
  characterId: string,
  attribute: string,
) => `${characterId}::${attribute.trim().toLowerCase()}`;

export const buildSnippetKey = (
  perspectiveNodeId: string,
  snippetText: string,
) => `${perspectiveNodeId}::${snippetText.trim()}`;

export type SelectedSnippet = {
  perspectiveNodeId: string;
  text: string;
  characterId: string;
  characterName: string;
  attributes: string[];
};

export type ExtractedCharacter = {
  name: string;
  role: string;
};

type WorkflowState = {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  selectedEvidenceAttributes: Record<string, boolean>;
  selectedSnippets: Record<string, SelectedSnippet>;
  extractedCharacters: Record<string, ExtractedCharacter[]>;
  setNodes: (updater: StateUpdater<WorkflowNode[]>) => void;
  setEdges: (updater: StateUpdater<WorkflowEdge[]>) => void;
  onNodesChange: (changes: NodeChange<WorkflowNode>[]) => void;
  onEdgesChange: (changes: EdgeChange<WorkflowEdge>[]) => void;
  toggleEvidenceAttribute: (characterId: string, attribute: string) => void;
  clearEvidenceAttribute: (characterId: string, attribute: string) => void;
  clearAllEvidenceAttributes: () => void;
  toggleSnippet: (snippet: SelectedSnippet) => void;
  clearSnippet: (perspectiveNodeId: string, snippetText: string) => void;
  clearAllSnippets: () => void;
  setExtractedCharacters: (
    eventGroupId: string,
    characters: ExtractedCharacter[],
  ) => void;
  reset: () => void;
};

const deepClone = <T>(value: T): T => {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value)) as T;
};

const ATTRIBUTE_HANDLE_PATTERN = /-(physiology|psychology|sociology)-/;
const STORAGE_VERSION = 5;

const sanitizeEdges = (edges: WorkflowEdge[]): WorkflowEdge[] =>
  edges.filter((edge) => {
    const sourceHandle = edge.sourceHandle ?? "";
    const targetHandle = edge.targetHandle ?? "";
    return (
      !ATTRIBUTE_HANDLE_PATTERN.test(sourceHandle) &&
      !ATTRIBUTE_HANDLE_PATTERN.test(targetHandle) &&
      sourceHandle !== "event" &&
      targetHandle !== "event"
    );
  });

const buildCharacterNodeData = (
  currentData: CharacterNodeType["data"] | undefined,
  perspectiveId: string,
): CharacterNodeType["data"] => {
  const baseTraits =
    currentData?.traits ?? {
      physiology: [],
      psychology: [],
      sociology: [],
    };

  return {
    ...(currentData ?? {
      name: "",
      traits: baseTraits,
      perspectiveId: "",
    }),
    traits: baseTraits,
    perspectiveId,
  };
};

// Keep each character node's perspectiveId in sync with the actual edges that
// connect characters to perspective nodes so UI affordances stay accurate.
const synchronizeCharacterPerspectiveLinks = (
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
): WorkflowNode[] => {
  if (!nodes || nodes.length === 0) {
    return nodes ?? [];
  }

  if (!edges || edges.length === 0) {
    let changed = false;
    const detachedNodes = nodes.map((node) => {
      if (node.type !== "character") {
        return node;
      }

      const currentData = node.data as CharacterNodeType["data"] | undefined;
      const currentPerspectiveId = currentData?.perspectiveId ?? "";
      const shouldBeDraggable = true;
      const shouldClampToParent: CharacterNodeType["extent"] = undefined;
      if (
        currentPerspectiveId === "" &&
        node.draggable === shouldBeDraggable &&
        node.extent === shouldClampToParent
      ) {
        return node;
      }

      changed = true;

      return {
        ...node,
        data: buildCharacterNodeData(currentData, ""),
        draggable: shouldBeDraggable,
        extent: shouldClampToParent,
      };
    });

    return changed ? detachedNodes : nodes;
  }

  const nodeLookup = new Map(nodes.map((node) => [node.id, node]));
  const perspectiveParentLookup = new Map(
    nodes
      .filter((node): node is PerspectiveNodeType => node.type === "perspective")
      .map((node) => [node.id, node.parentId]),
  );
  const characterAssignments = new Map<string, string>();

  edges.forEach((edge) => {
    const sourceNode = nodeLookup.get(edge.source);
    const targetNode = nodeLookup.get(edge.target);
    if (!sourceNode || !targetNode) {
      return;
    }

    if (sourceNode.type === "character" && targetNode.type === "perspective") {
      characterAssignments.set(sourceNode.id, targetNode.id);
      return;
    }

    if (sourceNode.type === "perspective" && targetNode.type === "character") {
      characterAssignments.set(targetNode.id, sourceNode.id);
    }
  });

  let updated = false;

  const normalizedNodes = nodes.map((node) => {
    if (node.type !== "character") {
      return node;
    }

    const targetPerspectiveId = characterAssignments.get(node.id) ?? "";
    const currentData = node.data as CharacterNodeType["data"] | undefined;
    const currentPerspectiveId = currentData?.perspectiveId ?? "";
    const shouldBeDraggable = targetPerspectiveId === "";
    const targetParentId =
      targetPerspectiveId === ""
        ? node.parentId
        : perspectiveParentLookup.get(targetPerspectiveId) ?? node.parentId;
    const targetExtent: CharacterNodeType["extent"] =
      targetPerspectiveId === "" ? undefined : "parent";

    if (
      currentPerspectiveId === targetPerspectiveId &&
      node.draggable === shouldBeDraggable &&
      node.parentId === targetParentId &&
      node.extent === targetExtent
    ) {
      return node;
    }

    updated = true;

    return {
      ...node,
      data: buildCharacterNodeData(currentData, targetPerspectiveId),
      draggable: shouldBeDraggable,
      parentId: targetParentId,
      extent: targetExtent,
    };
  });

  return updated ? normalizedNodes : nodes;
};

const synchronizePerspectiveGroupEventLinks = (
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
): WorkflowNode[] => {
  if (!nodes || nodes.length === 0) {
    return nodes ?? [];
  }

  const perspectiveGroups = nodes.filter(
    (node): node is PerspectiveGroupNodeType => node.type === "perspectiveGroup",
  );
  if (perspectiveGroups.length === 0) {
    return nodes;
  }

  const nodeLookup = new Map(nodes.map((node) => [node.id, node]));
  const eventGroupMetadata = new Map(
    nodes
      .filter((node) => node.type === "eventGroup")
      .map((node) => {
        const data = node.data as {
          label?: string;
          eventGroupId?: number;
        };
        return [
          node.id,
          {
            id: node.id,
            label: data?.label,
            eventGroupId: data?.eventGroupId,
          },
        ];
      }),
  );

  const perspectiveGroupConnections = new Map<string, string>();

  edges.forEach((edge) => {
    if (
      edge.sourceHandle !== "group-bridge" ||
      edge.targetHandle !== "group-bridge"
    ) {
      return;
    }

    const sourceNode = nodeLookup.get(edge.source);
    const targetNode = nodeLookup.get(edge.target);
    if (!sourceNode || !targetNode) {
      return;
    }

    if (
      sourceNode.type === "eventGroup" &&
      targetNode.type === "perspectiveGroup"
    ) {
      perspectiveGroupConnections.set(targetNode.id, sourceNode.id);
      return;
    }

    if (
      sourceNode.type === "perspectiveGroup" &&
      targetNode.type === "eventGroup"
    ) {
      perspectiveGroupConnections.set(sourceNode.id, targetNode.id);
    }
  });

  let changed = false;

  const updatedNodes = nodes.map((node) => {
    if (node.type !== "perspectiveGroup") {
      return node;
    }

    const currentData = (node.data ?? {}) as PerspectiveGroupNodeType["data"];
    const existingConnected = currentData.connectedEventGroup;

    const connectedEventGroupId = perspectiveGroupConnections.get(node.id);
    const eventGroupData = connectedEventGroupId
      ? eventGroupMetadata.get(connectedEventGroupId)
      : undefined;

    if (!eventGroupData) {
      if (!existingConnected) {
        return node;
      }

      const { connectedEventGroup: _removed, ...restData } = currentData as Record<
        string,
        unknown
      >;
      changed = true;
      return {
        ...node,
        data: restData as PerspectiveGroupNodeType["data"],
      };
    }

    if (
      existingConnected &&
      existingConnected.id === eventGroupData.id &&
      existingConnected.label === eventGroupData.label &&
      existingConnected.eventGroupId === eventGroupData.eventGroupId
    ) {
      return node;
    }

    changed = true;
    return {
      ...node,
      data: {
        ...currentData,
        connectedEventGroup: eventGroupData,
      },
    };
  });

  return changed ? updatedNodes : nodes;
};

const applyDerivedNodeState = (
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
): WorkflowNode[] => {
  const withCharacterLinks = synchronizeCharacterPerspectiveLinks(nodes, edges);
  return synchronizePerspectiveGroupEventLinks(withCharacterLinks, edges);
};

const getInitialState = () => {
  const nodes = deepClone(initialNodes);
  const edges = sanitizeEdges(deepClone(initialEdges));

  return {
    nodes: applyDerivedNodeState(nodes, edges),
    edges,
    selectedEvidenceAttributes: {},
    selectedSnippets: {},
    extractedCharacters: {},
  };
};

const ensureNarrationGroupCharacterNames = (
  nodes: WorkflowNode[] | undefined,
): WorkflowNode[] => {
  if (!nodes || nodes.length === 0) {
    return nodes ?? [];
  }

  return nodes.map((node) => {
    if (node.type !== "perspectiveGroup") {
      return node;
    }

    const groupData = node.data ?? {};
    const existingName = (
      groupData as { characterName?: string }
    ).characterName?.trim();
    if (existingName && existingName.length > 0) {
      return node;
    }

    const parentId = node.id;
    const fallbackCharacter = nodes.find(
      (candidate): candidate is CharacterNodeType =>
        candidate.parentId === parentId &&
        candidate.type === "character" &&
        Boolean(candidate.data?.name?.trim()),
    );

    const fallbackNameFromCharacter = fallbackCharacter?.data?.name?.trim();

    const fallbackPerspective = nodes.find(
      (candidate): candidate is PerspectiveNodeType =>
        candidate.parentId === parentId &&
        candidate.type === "perspective" &&
        Boolean(candidate.data?.narrator?.trim()),
    );

    const fallbackName =
      fallbackNameFromCharacter ??
      fallbackPerspective?.data?.narrator?.trim() ??
      "";

    if (!fallbackName) {
      return node;
    }

    return {
      ...node,
      data: {
        ...groupData,
        characterName: fallbackName,
      },
    };
  });
};

export const useWorkflowStore = create<WorkflowState>()(
  persist(
    (set, get) => ({
      ...getInitialState(),
      setNodes: (updater) =>
        set((state) => {
          const nextNodes =
            typeof updater === "function"
              ? (updater as (nodes: WorkflowNode[]) => WorkflowNode[])(
                  state.nodes,
                )
              : updater;

          return {
            nodes: applyDerivedNodeState(nextNodes, state.edges),
          };
        }),
      setEdges: (updater) =>
        set((state) => {
          const nextEdges = sanitizeEdges(
            typeof updater === "function"
              ? (updater as (edges: WorkflowEdge[]) => WorkflowEdge[])(
                  state.edges,
                )
              : updater,
          );

          const nextNodes = applyDerivedNodeState(state.nodes, nextEdges);

          return {
            edges: nextEdges,
            nodes: nextNodes,
          };
        }),
      onNodesChange: (changes) =>
        set((state) => {
          const updatedNodes = applyNodeChanges(changes, state.nodes);
          return {
            nodes: applyDerivedNodeState(updatedNodes, state.edges),
          };
        }),
      onEdgesChange: (changes) =>
        set((state) => {
          const nextEdges = sanitizeEdges(
            applyEdgeChanges(changes, state.edges),
          );
          const nextNodes = applyDerivedNodeState(state.nodes, nextEdges);

          return {
            edges: nextEdges,
            nodes: nextNodes,
          };
        }),
      toggleEvidenceAttribute: (characterId, attribute) =>
        set((state) => {
          const key = buildEvidenceAttributeKey(characterId, attribute);
          const current = state.selectedEvidenceAttributes ?? {};
          const next = { ...current };
          const isDeselecting = Boolean(next[key]);

          if (isDeselecting) {
            delete next[key];

            // When deselecting a trait, also deselect all snippets associated with this trait
            const normalizedAttribute = attribute.trim().toLowerCase();
            const nextSnippets = { ...state.selectedSnippets };
            let snippetsChanged = false;

            Object.keys(nextSnippets).forEach((snippetKey) => {
              const snippet = nextSnippets[snippetKey];
              if (
                snippet.characterId === characterId &&
                snippet.attributes.some(
                  (attr) => attr.trim().toLowerCase() === normalizedAttribute,
                )
              ) {
                delete nextSnippets[snippetKey];
                snippetsChanged = true;
              }
            });

            if (snippetsChanged) {
              return {
                selectedEvidenceAttributes: next,
                selectedSnippets: nextSnippets,
              };
            }

            return { selectedEvidenceAttributes: next };
          } else {
            next[key] = true;
            return { selectedEvidenceAttributes: next };
          }
        }),
      clearEvidenceAttribute: (characterId, attribute) =>
        set((state) => {
          const key = buildEvidenceAttributeKey(characterId, attribute);
          if (!state.selectedEvidenceAttributes?.[key]) {
            return {};
          }
          const next = { ...state.selectedEvidenceAttributes };
          delete next[key];
          return { selectedEvidenceAttributes: next };
        }),
      clearAllEvidenceAttributes: () => set({ selectedEvidenceAttributes: {} }),
      toggleSnippet: (snippet) =>
        set((state) => {
          const key = buildSnippetKey(snippet.perspectiveNodeId, snippet.text);
          const current = state.selectedSnippets ?? {};
          const next = { ...current };
          if (next[key]) {
            delete next[key];
          } else {
            next[key] = snippet;
          }
          return { selectedSnippets: next };
        }),
      clearSnippet: (perspectiveNodeId, snippetText) =>
        set((state) => {
          const key = buildSnippetKey(perspectiveNodeId, snippetText);
          if (!state.selectedSnippets?.[key]) {
            return {};
          }
          const next = { ...state.selectedSnippets };
          delete next[key];
          return { selectedSnippets: next };
        }),
      clearAllSnippets: () => set({ selectedSnippets: {} }),
      setExtractedCharacters: (eventGroupId, characters) =>
        set((state) => ({
          extractedCharacters: {
            ...state.extractedCharacters,
            [eventGroupId]: characters,
          },
        })),
      reset: () => set(getInitialState()),
    }),
    {
      name: "workflow-canvas-storage",
      version: STORAGE_VERSION,
      migrate: (persistedState, version) => {
        if (!persistedState) {
          return getInitialState();
        }

        const state = persistedState as Partial<WorkflowState>;
        const shouldEnsureNames = version < STORAGE_VERSION;
        const edges = sanitizeEdges(state.edges ?? []);
        const nodesWithNames = shouldEnsureNames
          ? ensureNarrationGroupCharacterNames(state.nodes)
          : state.nodes ?? [];
        const normalizedNodes = applyDerivedNodeState(nodesWithNames, edges);

        return {
          ...state,
          nodes: normalizedNodes,
          edges,
          selectedEvidenceAttributes: state.selectedEvidenceAttributes ?? {},
          selectedSnippets: state.selectedSnippets ?? {},
          extractedCharacters: state.extractedCharacters ?? {},
        };
      },
      partialize: (state) => ({
        nodes: state.nodes,
        edges: state.edges,
        selectedEvidenceAttributes: state.selectedEvidenceAttributes,
        selectedSnippets: state.selectedSnippets,
        extractedCharacters: state.extractedCharacters,
      }),
    },
  ),
);
