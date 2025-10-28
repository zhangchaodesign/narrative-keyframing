"use client";

import { useCallback, useEffect, useMemo } from "react";
import {
  Position,
  type NodeProps,
  useReactFlow,
  useStore,
} from "@xyflow/react";
import { CustomHandle } from "@/components/WorkflowCanvas/CustomHandle";
import { PerspectiveHandle } from "@/components/WorkflowCanvas/PerspectiveNode/PerspectiveHandle";
import { NodeActionMenu } from "@/components/WorkflowCanvas/NodeActionMenu";
import type {
  CharacterNodeType,
  EventNodeType,
  PerspectiveNodeType,
  WorkflowEdge,
  WorkflowNode,
} from "@/lib/types/workflow";

const NARRATION_HORIZONTAL_GAP = 300;

export function PerspectiveNode({ id, data }: NodeProps<PerspectiveNodeType>) {
  const { setNodes } = useReactFlow<WorkflowNode, WorkflowEdge>();
  const edges = useStore((store) => store.edges);
  const nodes = useStore((store) => store.nodes);
  const isLoading = data?.isLoading ?? false;

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
  const { narratorName, hasDirectCharacter, isFromPrevious } = useMemo(() => {
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

    const findNarrator = (
      narrationId: string,
    ): { name: string; originId: string } | null => {
      if (visited.has(narrationId)) {
        return null;
      }
      visited.add(narrationId);

      const characterName = getCharacterName(narrationId);
      if (characterName) {
        return { name: characterName, originId: narrationId };
      }

      const previousEdges = edges.filter(
        (edge) =>
          edge.target === narrationId &&
          edge.targetHandle === "perspective-prev",
      );

      for (const prevEdge of previousEdges) {
        const prevNode = nodes.find(
          (node) => node.id === prevEdge.source && node.type === "perspective",
        ) as PerspectiveNodeType | undefined;
        if (!prevNode) {
          continue;
        }

        const narratorFromPrev = findNarrator(prevNode.id);
        if (narratorFromPrev) {
          return narratorFromPrev;
        }
      }

      const currentNode = nodes.find(
        (node) => node.id === narrationId && node.type === "perspective",
      ) as PerspectiveNodeType | undefined;
      const fallbackName = currentNode?.data?.narrator?.trim();
      if (!fallbackName) {
        return null;
      }

      return { name: fallbackName, originId: narrationId };
    };

    const narratorFromGraph = findNarrator(id);
    const directCharacterName = getCharacterName(id);
    const name =
      narratorFromGraph?.name ?? directCharacterName ?? "Unknown narrator";
    const originId =
      narratorFromGraph?.originId ?? (directCharacterName ? id : null);

    return {
      narratorName: name,
      hasDirectCharacter: Boolean(directCharacterName),
      isFromPrevious: originId !== null && originId !== id,
    };
  }, [edges, id, nodes]);
  useEffect(() => {
    if (hasDirectCharacter || !isFromPrevious) {
      return;
    }

    const trimmedNarrator = narratorName.trim();
    if (!trimmedNarrator || trimmedNarrator === "Unknown narrator") {
      return;
    }

    const currentNarrator = data?.narrator?.trim() ?? "";
    if (currentNarrator === trimmedNarrator) {
      return;
    }

    setNodes((nodesState) =>
      nodesState.map((node) => {
        if (node.id !== id || node.type !== "perspective") {
          return node;
        }

        return {
          ...node,
          data: {
            ...node.data,
            narrator: trimmedNarrator,
          },
        };
      }),
    );
  }, [
    data?.narrator,
    hasDirectCharacter,
    id,
    isFromPrevious,
    narratorName,
    setNodes,
  ]);
  const eventBadgeClass =
    "inline-flex items-center rounded bg-zinc-50 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-zinc-600";
  const narratorBadgeClass =
    "inline-flex items-center rounded bg-warning/10 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-warning";

  return (
    <div className="group relative flex h-44 w-64 flex-col rounded-lg border-2 border-secondary bg-white p-3 text-xs hover:shadow-lg">
      {isLoading && (
        <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center rounded-lg bg-white/80 backdrop-blur-sm">
          <span className="loading loading-spinner text-secondary"></span>
          <span className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-secondary">
            Preparing perspective...
          </span>
        </div>
      )}
      <NodeActionMenu nodeId={id} nodeType="perspective" />
      <div className="flex w-full flex-wrap items-center gap-1 text-[10px] font-semibold tracking-wide text-zinc-800 uppercase">
        <span className="flex items-center">💬 Perspective</span>
      </div>
      <div
        className="mt-2 flex-1 overflow-y-auto w-full resize-none rounded bg-zinc-50 px-2 py-1 text-[10px] leading-snug text-zinc-800"
        onWheel={(event) => {
          if (event.ctrlKey || event.metaKey) {
            return;
          }
          event.stopPropagation();
          event.nativeEvent.stopImmediatePropagation?.();
        }}
        onWheelCapture={(event) => {
          if (event.ctrlKey || event.metaKey) {
            return;
          }
          event.stopPropagation();
          event.nativeEvent.stopImmediatePropagation?.();
        }}
      >
        {data?.reflection}
      </div>
      <div className="mt-2 flex gap-2">
        <span className={eventBadgeClass}>{eventLabel}</span>
        <span className={narratorBadgeClass}>{narratorName}</span>
      </div>
      <PerspectiveHandle
        type="target"
        position={Position.Left}
        id="perspective-prev"
      />
      <PerspectiveHandle
        type="source"
        position={Position.Right}
        id="perspective-next"
      />
      <CustomHandle type="target" position={Position.Top} id="event" />
      <CustomHandle type="target" position={Position.Bottom} id="character" />
    </div>
  );
}
