"use client";

import { useCallback, useContext, useMemo } from "react";
import { useReactFlow } from "@xyflow/react";
import { TbCopy, TbPlayerPlay, TbTrash } from "react-icons/tb";

import { RunPerspectiveContext } from "@/components/WorkflowCanvas/RunPerspectiveContext";
import type { WorkflowEdge, WorkflowNode } from "@/lib/types/workflow";

type NodeActionMenuProps = {
  nodeId: string;
  nodeType: WorkflowNode["type"];
};

const CLONE_OFFSET = 40;

function cloneData<DataType>(data: DataType): DataType {
  if (data == null) {
    return data;
  }

  try {
    return JSON.parse(JSON.stringify(data)) as DataType;
  } catch {
    return data;
  }
}

export function NodeActionMenu({ nodeId, nodeType }: NodeActionMenuProps) {
  const { setNodes, setEdges } = useReactFlow<WorkflowNode, WorkflowEdge>();
  const runPerspectives = useContext(RunPerspectiveContext);

  const isPerspectiveNode = useMemo(
    () => nodeType === "perspective",
    [nodeType],
  );

  const handleDelete = useCallback(() => {
    setNodes((nodes) => nodes.filter((node) => node.id !== nodeId));
    setEdges((edges) =>
      edges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId),
    );
  }, [nodeId, setEdges, setNodes]);

  const handleDuplicate = useCallback(() => {
    setNodes((nodes) => {
      const original = nodes.find((node) => node.id === nodeId);
      if (!original) {
        return nodes;
      }

      const existingIds = new Set(nodes.map((node) => node.id));
      const baseId = `${original.id}-copy`;
      let candidateId = baseId;
      let attempt = 1;

      while (existingIds.has(candidateId)) {
        attempt += 1;
        candidateId = `${baseId}-${attempt}`;
      }

      const duplicatedNode = {
        ...original,
        id: candidateId,
        data: cloneData(original.data),
        position: {
          x: original.position.x + CLONE_OFFSET,
          y: original.position.y + CLONE_OFFSET,
        },
        selected: false,
        dragging: false,
      } as WorkflowNode;

      return [...nodes, duplicatedNode];
    });
  }, [nodeId, setNodes]);

  const handleRun = useCallback(() => {
    if (!isPerspectiveNode) {
      return;
    }
    runPerspectives();
  }, [isPerspectiveNode, runPerspectives]);

  return (
    <div className="pointer-events-none absolute -top-9 right-0 flex items-center gap-1 rounded-lg border border-zinc-200 bg-white p-1 text-zinc-500 shadow-sm opacity-0 transition group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100">
      {isPerspectiveNode && (
        <button
          type="button"
          onClick={handleRun}
          className="pointer-events-auto rounded-full p-1 transition hover:bg-green-50 hover:text-green-600 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-green-500 cursor-pointer"
          title="Run perspective"
          aria-label="Run perspective"
        >
          <TbPlayerPlay size={12} />
        </button>
      )}
      <button
        type="button"
        onClick={handleDuplicate}
        className="pointer-events-auto rounded-full p-1 transition hover:bg-zinc-100 hover:text-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-indigo-500 cursor-pointer"
        title="Duplicate node"
        aria-label="Duplicate node"
      >
        <TbCopy size={12} />
      </button>
      <button
        type="button"
        onClick={handleDelete}
        className="pointer-events-auto rounded-full p-1 text-red-500 transition hover:bg-red-50 hover:text-red-600 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-red-500 cursor-pointer"
        title="Delete node"
        aria-label="Delete node"
      >
        <TbTrash size={12} />
      </button>
    </div>
  );
}
