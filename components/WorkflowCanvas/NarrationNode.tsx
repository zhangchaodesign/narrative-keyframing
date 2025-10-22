"use client";

import { useCallback, useMemo } from "react";
import {
  Position,
  type NodeProps,
  useReactFlow,
  useStore,
} from "@xyflow/react";
import { CustomHandle } from "./CustomHandle";
import { NarrationHandle } from "./NarrationHandle";
import { NodeActionMenu } from "./NodeActionMenu";
import type {
  CharacterNodeType,
  EventNodeType,
  NarrationNodeType,
  WorkflowEdge,
  WorkflowNode,
} from "./workflow.constants";

const NARRATION_HORIZONTAL_GAP = 300;

export function NarrationNode({ id, data }: NodeProps<NarrationNodeType>) {
  const { setNodes, setEdges, getNode, getNodes } = useReactFlow<
    WorkflowNode,
    WorkflowEdge
  >();
  const edges = useStore((store) => store.edges);
  const nodes = useStore((store) => store.nodes);

  const hasPreviousNarration = edges.some(
    (edge) => edge.target === id && edge.targetHandle === "narration-prev",
  );
  const hasNextNarration = edges.some(
    (edge) => edge.source === id && edge.sourceHandle === "narration-next",
  );

  const handleAddAdjacentNarration = useCallback(
    (direction: "before" | "after") => {
      const referenceNode = getNode(id);
      if (!referenceNode) {
        return;
      }

      const newNodeId = `narration-${Date.now()}`;
      const narrationCount = getNodes().filter(
        (node) => node.type === "narration",
      ).length;
      const xOffset =
        direction === "before"
          ? -NARRATION_HORIZONTAL_GAP
          : NARRATION_HORIZONTAL_GAP;

      const newNode: NarrationNodeType = {
        id: newNodeId,
        type: "narration",
        position: {
          x: referenceNode.position.x + xOffset,
          y: referenceNode.position.y,
        },
        data: {
          narrator: `Narrator ${narrationCount + 1}`,
          reflection: "Write the next reflection...",
        },
        draggable: false,
      };

      setNodes((nodesState) => [...nodesState, newNode] as WorkflowNode[]);
      const newEdge: WorkflowEdge = {
        id: `edge-${
          direction === "before" ? `${newNodeId}-${id}` : `${id}-${newNodeId}`
        }-${Date.now()}`,
        source: direction === "before" ? newNodeId : id,
        target: direction === "before" ? id : newNodeId,
        sourceHandle: "narration-next",
        targetHandle: "narration-prev",
        type: "customEdge",
        animated: true,
      };
      setEdges((edgesState) => {
        const alreadyExists = edgesState.some(
          (edge) =>
            edge.source === newEdge.source &&
            edge.target === newEdge.target &&
            edge.sourceHandle === newEdge.sourceHandle &&
            edge.targetHandle === newEdge.targetHandle,
        );
        if (alreadyExists) {
          return edgesState;
        }
        return [...edgesState, newEdge];
      });
    },
    [getNode, getNodes, id, setEdges, setNodes],
  );

  const connectedEventLabel = useMemo(() => {
    const eventEdge = edges.find(
      (edge) => edge.target === id && edge.targetHandle === "event",
    );
    if (!eventEdge) {
      return null;
    }

    const eventNode = nodes.find(
      (node) => node.id === eventEdge.source && node.type === "event",
    ) as EventNodeType | undefined;

    const timeline = eventNode?.data?.timeline?.trim();
    const description = eventNode?.data?.description?.trim();

    const label = timeline || description || eventNode?.id;
    if (!label) {
      return null;
    }

    if (label.startsWith("Event")) {
      return label;
    }

    return `Event ${label}`;
  }, [edges, id, nodes]);

  const eventLabel = connectedEventLabel?.trim() || "Event";
  const narratorName = useMemo(() => {
    const visited = new Set<string>();

    const getCharacterName = (narrationId: string) => {
      const characterEdge = edges.find(
        (edge) =>
          edge.target === narrationId && edge.targetHandle === "character",
      );
      if (!characterEdge) {
        return null;
      }

      const characterNode = nodes.find(
        (node) => node.id === characterEdge.source && node.type === "character",
      ) as CharacterNodeType | undefined;

      const name = characterNode?.data?.name?.trim();
      return name || null;
    };

    const findNarrator = (narrationId: string): string | null => {
      if (visited.has(narrationId)) {
        return null;
      }
      visited.add(narrationId);

      const characterName = getCharacterName(narrationId);
      if (characterName) {
        return characterName;
      }

      const previousEdges = edges.filter(
        (edge) =>
          edge.target === narrationId && edge.targetHandle === "narration-prev",
      );

      for (const prevEdge of previousEdges) {
        const prevNode = nodes.find(
          (node) => node.id === prevEdge.source && node.type === "narration",
        ) as NarrationNodeType | undefined;
        if (!prevNode) {
          continue;
        }

        const narratorFromPrev = findNarrator(prevNode.id);
        if (narratorFromPrev) {
          return narratorFromPrev;
        }
      }

      const currentNode = nodes.find(
        (node) => node.id === narrationId && node.type === "narration",
      ) as NarrationNodeType | undefined;
      const fallbackName = currentNode?.data?.narrator?.trim();
      return fallbackName || null;
    };

    return findNarrator(id) ?? "Unknown narrator";
  }, [edges, id, nodes]);
  const eventBadgeClass =
    "inline-flex items-center rounded bg-zinc-50 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-zinc-600";
  const narratorBadgeClass =
    "inline-flex items-center rounded bg-yellow-50 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-yellow-600";

  return (
    <div className="group relative flex h-44 w-64 flex-col rounded-lg border-2 border-indigo-400 bg-white p-3 text-xs hover:shadow-lg">
      {!hasPreviousNarration && (
        <button
          type="button"
          onClick={() => handleAddAdjacentNarration("before")}
          className="absolute left-[-320px] top-1/2 z-10 flex h-full w-full -translate-y-1/2 flex-col items-center justify-center rounded-lg border-2 border-dashed border-zinc-300 bg-zinc-100/70 text-[10px] font-semibold uppercase tracking-wide text-zinc-400 opacity-0 transition hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 group-hover:opacity-100"
          title="Add narration before"
          aria-label="Add narration before"
        >
          <span className="text-lg leading-none">＋</span>
          <span>Add Narration</span>
        </button>
      )}
      {!hasNextNarration && (
        <button
          type="button"
          onClick={() => handleAddAdjacentNarration("after")}
          className="absolute right-[-320px] top-1/2 z-10 flex h-full w-full -translate-y-1/2 flex-col items-center justify-center rounded-lg border-2 border-dashed border-zinc-300 bg-zinc-100/70 text-[10px] font-semibold uppercase tracking-wide text-zinc-400 opacity-0 transition hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 group-hover:opacity-100"
          title="Add narration after"
          aria-label="Add narration after"
        >
          <span className="text-lg leading-none">＋</span>
          <span>Add Narration</span>
        </button>
      )}
      <NodeActionMenu nodeId={id} />
      <div className="flex w-full flex-wrap items-center gap-1 text-[10px] font-semibold tracking-wide text-zinc-800 uppercase">
        <span className="flex items-center">💬 Narration</span>
      </div>
      <div className="mt-2 flex-1 overflow-y-auto w-full resize-none rounded bg-zinc-50 px-2 py-1 text-[10px] leading-snug text-zinc-800">
        {data?.reflection}
      </div>
      <div className="mt-2 flex gap-2">
        <span className={eventBadgeClass}>{eventLabel}</span>
        <span className={narratorBadgeClass}>{narratorName}</span>
      </div>
      <NarrationHandle
        type="target"
        position={Position.Left}
        id="narration-prev"
      />
      <NarrationHandle
        type="source"
        position={Position.Right}
        id="narration-next"
      />
      <CustomHandle type="target" position={Position.Top} id="event" />
      <CustomHandle type="target" position={Position.Bottom} id="character" />
    </div>
  );
}
