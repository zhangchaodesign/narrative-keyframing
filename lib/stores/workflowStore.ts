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

type WorkflowState = {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  selectedEvidenceAttributes: Record<string, boolean>;
  selectedSnippets: Record<string, SelectedSnippet>;
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
  reset: () => void;
};

const deepClone = <T>(value: T): T => {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value)) as T;
};

const ATTRIBUTE_HANDLE_PATTERN = /-(physiology|psychology|sociology)-/;
const STORAGE_VERSION = 4;

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
      if (currentPerspectiveId === "") {
        return node;
      }

      changed = true;
      const nextData: CharacterNodeType["data"] = {
        ...(currentData ?? {
          name: "",
          traits: {
            physiology: [],
            psychology: [],
            sociology: [],
          },
          perspectiveId: "",
        }),
        traits: currentData?.traits ?? {
          physiology: [],
          psychology: [],
          sociology: [],
        },
        perspectiveId: "",
      };

      return {
        ...node,
        data: nextData,
      };
    });

    return changed ? detachedNodes : nodes;
  }

  const nodeLookup = new Map(nodes.map((node) => [node.id, node]));
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

    if (currentPerspectiveId === targetPerspectiveId) {
      return node;
    }

    updated = true;

    const baseTraits = currentData?.traits ?? {
      physiology: [],
      psychology: [],
      sociology: [],
    };

    const nextData: CharacterNodeType["data"] = {
      ...(currentData ?? {
        name: "",
        traits: baseTraits,
        perspectiveId: "",
      }),
      traits: baseTraits,
      perspectiveId: targetPerspectiveId,
    };

    return {
      ...node,
      data: nextData,
    };
  });

  return updated ? normalizedNodes : nodes;
};

const getInitialState = () => {
  const nodes = deepClone(initialNodes);
  const edges = sanitizeEdges(deepClone(initialEdges));

  return {
    nodes: synchronizeCharacterPerspectiveLinks(nodes, edges),
    edges,
    selectedEvidenceAttributes: {},
    selectedSnippets: {},
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
        set((state) => ({
          nodes:
            typeof updater === "function"
              ? (updater as (nodes: WorkflowNode[]) => WorkflowNode[])(
                  state.nodes,
                )
              : updater,
        })),
      setEdges: (updater) =>
        set((state) => {
          const nextEdges = sanitizeEdges(
            typeof updater === "function"
              ? (updater as (edges: WorkflowEdge[]) => WorkflowEdge[])(
                  state.edges,
                )
              : updater,
          );

          const nextNodes = synchronizeCharacterPerspectiveLinks(
            state.nodes,
            nextEdges,
          );

          return {
            edges: nextEdges,
            nodes: nextNodes,
          };
        }),
      onNodesChange: (changes) =>
        set({
          nodes: applyNodeChanges(changes, get().nodes),
        }),
      onEdgesChange: (changes) =>
        set((state) => {
          const nextEdges = sanitizeEdges(
            applyEdgeChanges(changes, state.edges),
          );
          const nextNodes = synchronizeCharacterPerspectiveLinks(
            state.nodes,
            nextEdges,
          );

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
          if (next[key]) {
            delete next[key];
          } else {
            next[key] = true;
          }
          return { selectedEvidenceAttributes: next };
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
      clearAllEvidenceAttributes: () =>
        set({ selectedEvidenceAttributes: {} }),
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
        const normalizedNodes = synchronizeCharacterPerspectiveLinks(
          nodesWithNames,
          edges,
        );

        return {
          ...state,
          nodes: normalizedNodes,
          edges,
          selectedEvidenceAttributes: state.selectedEvidenceAttributes ?? {},
          selectedSnippets: state.selectedSnippets ?? {},
        };
      },
      partialize: (state) => ({
        nodes: state.nodes,
        edges: state.edges,
        selectedEvidenceAttributes: state.selectedEvidenceAttributes,
        selectedSnippets: state.selectedSnippets,
      }),
    },
  ),
);
