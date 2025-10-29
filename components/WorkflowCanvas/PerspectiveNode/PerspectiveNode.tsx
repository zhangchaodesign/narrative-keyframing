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
import { PerspectiveMenu } from "@/components/WorkflowCanvas/PerspectiveNode/PerspectiveMenu";
import { AddCharacterButton } from "@/components/WorkflowCanvas/PerspectiveNode/AddCharacterButton";
import type {
  CharacterNodeType,
  EventNodeType,
  PerspectiveNodeType,
  WorkflowEdge,
  WorkflowNode,
} from "@/lib/types/workflow";
import { parseEventTimelineIndex } from "@/lib/workflow/perspective";

const NARRATION_HORIZONTAL_GAP = 300;
const CHARACTER_VERTICAL_GAP = 210;
const DEFAULT_NARRATION_GROUP_ID = "narration-group";

export function PerspectiveNode({ id, data }: NodeProps<PerspectiveNodeType>) {
  const { setNodes, setEdges, getNode } = useReactFlow<
    WorkflowNode,
    WorkflowEdge
  >();
  const edges = useStore((store) => store.edges);
  const nodes = useStore((store) => store.nodes);
  const isLoading = data?.isLoading ?? false;

  const associatedEventLabel = useMemo(() => {
    const eventNodes = nodes.filter(
      (node): node is EventNodeType => node.type === "event",
    );
    if (eventNodes.length === 0) {
      return null;
    }

    const sortedEventNodes = [...eventNodes].sort((nodeA, nodeB) => {
      const indexA = parseEventTimelineIndex(nodeA.data?.timeline);
      const indexB = parseEventTimelineIndex(nodeB.data?.timeline);

      if (indexA != null && indexB != null && indexA !== indexB) {
        return indexA - indexB;
      }

      if (indexA != null) return -1;
      if (indexB != null) return 1;

      return nodeA.position.x - nodeB.position.x;
    });

    const perspectiveNodes = nodes.filter(
      (node): node is PerspectiveNodeType => node.type === "perspective",
    );
    if (perspectiveNodes.length === 0) {
      return null;
    }

    const sortedPerspectiveNodes = [...perspectiveNodes].sort(
      (nodeA, nodeB) => nodeA.position.x - nodeB.position.x,
    );
    const perspectiveIndex = sortedPerspectiveNodes.findIndex(
      (node) => node.id === id,
    );
    if (perspectiveIndex === -1) {
      return null;
    }

    const fallbackPerspective = sortedPerspectiveNodes[perspectiveIndex];
    const initialEvent = sortedEventNodes[perspectiveIndex];

    const matchedEvent =
      initialEvent ??
      sortedEventNodes.reduce<EventNodeType | null>((closest, current) => {
        if (!fallbackPerspective) {
          return closest;
        }

        const currentDistance = Math.abs(
          current.position.x - fallbackPerspective.position.x,
        );
        if (!closest) {
          return current;
        }

        const closestDistance = Math.abs(
          closest.position.x - fallbackPerspective.position.x,
        );
        if (currentDistance < closestDistance) {
          return current;
        }

        return closest;
      }, null);

    if (!matchedEvent) {
      return null;
    }

    const timeline = matchedEvent.data?.timeline?.trim();
    const description = matchedEvent.data?.description?.trim();
    const label = timeline || description || matchedEvent.id;
    if (!label) {
      return null;
    }

    if (label.startsWith("Event")) {
      return label;
    }

    return `Event ${label}`;
  }, [id, nodes]);

  const eventLabel = associatedEventLabel?.trim() || "Event";
  const { narratorName, hasDirectCharacter, isFromPrevious } = useMemo(() => {
    const visited = new Set<string>();

    const getCharacterName = (perspectiveId: string) => {
      const characterEdge = edges.find(
        (edge) =>
          edge.target === perspectiveId && edge.targetHandle === "character",
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
      perspectiveId: string,
    ): { name: string; originId: string } | null => {
      if (visited.has(perspectiveId)) {
        return null;
      }
      visited.add(perspectiveId);

      const characterName = getCharacterName(perspectiveId);
      if (characterName) {
        return { name: characterName, originId: perspectiveId };
      }

      const previousEdges = edges.filter(
        (edge) =>
          edge.target === perspectiveId &&
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
        (node) => node.id === perspectiveId && node.type === "perspective",
      ) as PerspectiveNodeType | undefined;
      const fallbackName = currentNode?.data?.narrator?.trim();
      if (!fallbackName) {
        return null;
      }

      return { name: fallbackName, originId: perspectiveId };
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
  const handleCreateCharacter = useCallback(() => {
    const hasCharacterEdge = edges.some(
      (edge) => edge.target === id && edge.targetHandle === "character",
    );
    if (hasCharacterEdge) {
      return;
    }

    const perspectiveNode =
      getNode(id) ??
      (nodes.find((node) => node.id === id && node.type === "perspective") as
        | PerspectiveNodeType
        | undefined);
    if (!perspectiveNode) {
      return;
    }

    const timestamp = Date.now();
    const newCharacterId = `character-${timestamp}`;
    const newEdgeId = `edge-${newCharacterId}-${id}`;

    setNodes((nodesState) => {
      const characterNodes = nodesState.filter(
        (nodeState): nodeState is CharacterNodeType =>
          nodeState.type === "character",
      );
      const characterRowY =
        characterNodes[0]?.position.y ??
        perspectiveNode.position.y + CHARACTER_VERTICAL_GAP;
      const trimmedNarrator = data?.narrator?.trim();
      const defaultName =
        trimmedNarrator && trimmedNarrator !== "Unknown narrator"
          ? trimmedNarrator
          : `New Character ${characterNodes.length + 1}`;

      const newCharacterNode: WorkflowNode = {
        id: newCharacterId,
        type: "character",
        position: {
          x: perspectiveNode.position.x,
          y: characterRowY,
        },
        data: {
          name: defaultName,
          traits: {
            physiology: [],
            psychology: [],
            sociology: [],
          },
        },
        draggable: false,
        parentId: DEFAULT_NARRATION_GROUP_ID,
        extent: "parent",
      };

      return [...nodesState, newCharacterNode];
    });

    setEdges((edgesState) => [
      ...edgesState,
      {
        id: newEdgeId,
        source: newCharacterId,
        target: id,
        sourceHandle: "perspective",
        targetHandle: "character",
        type: "customEdge",
        animated: true,
      },
    ]);
  }, [data?.narrator, edges, getNode, id, nodes, setEdges, setNodes]);
  const eventBadgeClass =
    "inline-flex items-center rounded bg-zinc-50 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-zinc-600";
  const narratorBadgeClass =
    "inline-flex items-center rounded bg-warning/10 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-warning";

  return (
    <div className="group relative flex h-44 w-64 flex-col rounded-lg border-2 border-secondary bg-white p-3 text-xs hover:shadow-lg">
      {isLoading && (
        <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center rounded-lg bg-white/80 backdrop-blur-sm">
          <span className="loading loading-spinner text-primary"></span>
          <span className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-primary">
            Preparing perspective...
          </span>
        </div>
      )}
      <PerspectiveMenu nodeId={id} nodeType="perspective" />
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
      {!hasDirectCharacter && (
        <AddCharacterButton
          onClick={handleCreateCharacter}
          disabled={isLoading}
        />
      )}
      <CustomHandle type="target" position={Position.Bottom} id="character" />
    </div>
  );
}
