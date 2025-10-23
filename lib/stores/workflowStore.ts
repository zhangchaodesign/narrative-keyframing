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

const getInitialState = () => ({
  nodes: deepClone(initialNodes),
  edges: deepClone(initialEdges),
});

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
          edges:
            typeof updater === "function"
              ? (updater as (edges: WorkflowEdge[]) => WorkflowEdge[])(
                  state.edges,
                )
              : updater,
        })),
      onNodesChange: (changes) =>
        set({
          nodes: applyNodeChanges(changes, get().nodes),
        }),
      onEdgesChange: (changes) =>
        set({
          edges: applyEdgeChanges(changes, get().edges),
        }),
      reset: () => set(getInitialState()),
    }),
    {
      name: "workflow-canvas-storage",
      version: 1,
      partialize: (state) => ({
        nodes: state.nodes,
        edges: state.edges,
      }),
    },
  ),
);
