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

type WorkflowState = {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  setNodes: (updater: StateUpdater<WorkflowNode[]>) => void;
  setEdges: (updater: StateUpdater<WorkflowEdge[]>) => void;
  onNodesChange: (changes: NodeChange<WorkflowNode>[]) => void;
  onEdgesChange: (changes: EdgeChange<WorkflowEdge>[]) => void;
  reset: () => void;
};

const deepClone = <T>(value: T): T => {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value)) as T;
};

const ATTRIBUTE_HANDLE_PATTERN = /-(physiology|psychology|sociology)-/;
const STORAGE_VERSION = 3;

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

const getInitialState = () => ({
  nodes: deepClone(initialNodes),
  edges: sanitizeEdges(deepClone(initialEdges)),
});

const ensureNarrationGroupCharacterNames = (
  nodes: WorkflowNode[] | undefined,
): WorkflowNode[] => {
  if (!nodes || nodes.length === 0) {
    return nodes ?? [];
  }

  return nodes.map((node) => {
    if (node.type !== "narrationGroup") {
      return node;
    }

    const groupData = node.data ?? {};
    const existingName = (groupData as { characterName?: string }).characterName?.trim();
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
      fallbackNameFromCharacter ?? fallbackPerspective?.data?.narrator?.trim() ?? "";

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
        set((state) => ({
          edges: sanitizeEdges(
            typeof updater === "function"
              ? (updater as (edges: WorkflowEdge[]) => WorkflowEdge[])(
                  state.edges,
                )
              : updater,
          ),
        })),
      onNodesChange: (changes) =>
        set({
          nodes: applyNodeChanges(changes, get().nodes),
        }),
      onEdgesChange: (changes) =>
        set({
          edges: sanitizeEdges(applyEdgeChanges(changes, get().edges)),
        }),
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
        const nodes = shouldEnsureNames
          ? ensureNarrationGroupCharacterNames(state.nodes)
          : state.nodes ?? [];

        return {
          ...state,
          nodes,
          edges: sanitizeEdges(state.edges ?? []),
        };
      },
      partialize: (state) => ({
        nodes: state.nodes,
        edges: state.edges,
      }),
    },
  ),
);
