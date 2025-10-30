"use client";

import { useCallback, useState } from "react";
import { useReactFlow } from "@xyflow/react";
import { TbPlayerPlay } from "react-icons/tb";

import type {
  PerspectiveNodeType,
  WorkflowEdge,
  WorkflowNode,
} from "@/lib/types/workflow";
import {
  preparePerspectiveRequest,
  type GeneratePerspectiveResponse,
} from "@/lib/perspective";

type PerspectiveMenuProps = {
  nodeId: string;
};

export function PerspectiveMenu({ nodeId }: PerspectiveMenuProps) {
  const { setNodes, getNode, getNodes, getEdges } = useReactFlow<
    WorkflowNode,
    WorkflowEdge
  >();
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGeneratePerspectives = useCallback(
    async (targetNodeIds?: string[]) => {
      if (isGenerating) {
        return;
      }

      const nodes = getNodes();
      const edges = getEdges();

      setIsGenerating(true);
      let loadingNodeIds: Set<string> | null = null;

      try {
        const preparation = preparePerspectiveRequest({
          nodes,
          edges,
          targetNodeIds,
        });

        if (!preparation) {
          return;
        }

        const { eventSequence, tasks } = preparation;

        loadingNodeIds = new Set(tasks.map((task) => task.id));
        setNodes((currentNodes) =>
          currentNodes.map((node) => {
            if (node.type !== "perspective") {
              return node;
            }

            const existingData = node.data as PerspectiveNodeType["data"];
            return {
              ...node,
              data: {
                ...existingData,
                isLoading: loadingNodeIds?.has(node.id) ?? false,
              },
            };
          }),
        );

        const response = await fetch("/api/perspective", {
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

        if (orderedUpdates.length === 0) {
          return;
        }

        if (perspectives.length !== tasks.length) {
          console.warn(
            "Perspective response count did not match requested tasks.",
            {
              requested: tasks.length,
              received: perspectives.length,
            },
          );
        }

        const updateMap = new Map<string, string>(orderedUpdates);

        setNodes((currentNodes) =>
          currentNodes.map((node) => {
            if (node.type === "perspective" && updateMap.has(node.id)) {
              const reflection = updateMap.get(node.id) ?? "";
              const existingData = node.data as PerspectiveNodeType["data"];
              return {
                ...node,
                data: {
                  ...existingData,
                  reflection,
                },
              };
            }
            return node;
          }),
        );
      } catch (error) {
        console.error("Error generating perspectives:", error);
      } finally {
        if (loadingNodeIds) {
          setNodes((currentNodes) =>
            currentNodes.map((node) => {
              if (node.type !== "perspective") {
                return node;
              }
              if (!loadingNodeIds?.has(node.id)) {
                return node;
              }

              const existingData = node.data as PerspectiveNodeType["data"];
              return {
                ...node,
                data: {
                  ...existingData,
                  isLoading: false,
                },
              };
            }),
          );
        }
        setIsGenerating(false);
      }
    },
    [isGenerating, getNodes, getEdges, setNodes],
  );

  const handleRun = useCallback(() => {
    const currentNode = getNode(nodeId);
    const parentId = (currentNode as { parentId?: string }).parentId;
    const siblingPerspectiveIds = getNodes()
      .filter(
        (node) => node.type === "perspective" && node.parentId === parentId,
      )
      .map((node) => node.id);

    if (!parentId || !currentNode || siblingPerspectiveIds.length === 0) {
      return;
    }

    handleGeneratePerspectives(siblingPerspectiveIds);
  }, [getNode, getNodes, nodeId, handleGeneratePerspectives]);

  return (
    <div className="pointer-events-none absolute -top-9 right-0 flex items-center gap-1 rounded-lg border border-zinc-200 bg-white p-1 text-zinc-500 shadow-sm opacity-0 transition group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100">
      <button
        type="button"
        onClick={handleRun}
        className="pointer-events-auto rounded-full p-1 transition hover:bg-green-50 hover:text-green-600 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-green-500 cursor-pointer"
        title="Run perspective"
        aria-label="Run perspective"
      >
        <TbPlayerPlay size={12} />
      </button>
    </div>
  );
}
