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
  PerspectiveNodeType,
  WorkflowEdge,
  WorkflowNode,
} from "@/lib/types/workflow";
import { cn } from "@/lib/utils/utils";
import { geistMono } from "@/app/fonts";

const CHARACTER_VERTICAL_GAP = 210;
const DEFAULT_NARRATION_GROUP_ID = "perspective-group";

export function PerspectiveNode({ id, data }: NodeProps<PerspectiveNodeType>) {
  const { setNodes, setEdges, getNode } = useReactFlow<
    WorkflowNode,
    WorkflowEdge
  >();
  const edges = useStore((store) => store.edges);
  const nodes = useStore((store) => store.nodes);
  const isLoading = data?.isLoading ?? false;

  const hasDirectCharacter = useMemo(() => {
    const characterNode = nodes.find(
      (node) => node.data?.perspectiveId === id && node.type === "character",
    ) as CharacterNodeType | undefined;

    return Boolean(characterNode);
  }, [id, nodes]);

  // keep character nodes aligned with perspective node
  useEffect(() => {
    const perspectiveNode = nodes.find(
      (node): node is PerspectiveNodeType =>
        node.id === id && node.type === "perspective",
    );
    if (!perspectiveNode) {
      return;
    }

    const connectedCharacterIds = edges
      .filter(
        (edge) =>
          edge.target === id &&
          edge.targetHandle === "character" &&
          edge.sourceHandle === "perspective",
      )
      .map((edge) => edge.source);
    if (connectedCharacterIds.length === 0) {
      return;
    }

    const uniqueCharacterIds = new Set(connectedCharacterIds);
    const connectedCharacters = nodes.filter(
      (node): node is CharacterNodeType =>
        node.type === "character" && uniqueCharacterIds.has(node.id),
    );
    if (connectedCharacters.length === 0) {
      return;
    }

    const targetX = perspectiveNode.position.x;
    const needsAlignment = connectedCharacters.some(
      (characterNode) => Math.abs(characterNode.position.x - targetX) > 0.5,
    );
    if (!needsAlignment) {
      return;
    }

    setNodes((nodesState) =>
      nodesState.map((nodeState) => {
        if (
          nodeState.type === "character" &&
          uniqueCharacterIds.has(nodeState.id)
        ) {
          return {
            ...nodeState,
            position: {
              ...nodeState.position,
              x: targetX,
            },
          } as WorkflowNode;
        }
        return nodeState;
      }),
    );
  }, [edges, id, nodes, setNodes]);

  // function to create a new character node linked to this perspective
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

    const groupId = perspectiveNode.parentId;
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
      const targetPerspective = nodesState.find(
        (nodeState): nodeState is PerspectiveNodeType =>
          nodeState.id === id && nodeState.type === "perspective",
      );
      const trimmedNarrator = targetPerspective?.data?.narrator?.trim();
      const defaultName =
        trimmedNarrator && trimmedNarrator !== "Unknown narrator"
          ? trimmedNarrator
          : `New Character`;

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
          perspectiveId: id,
        },
        draggable: false,
        parentId: groupId ?? DEFAULT_NARRATION_GROUP_ID,
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
  }, [edges, getNode, id, nodes, setEdges, setNodes]);

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
      <PerspectiveMenu nodeId={id} nodeType="perspective" />
      <div
        className={cn(
          geistMono.className,
          "flex w-full flex-wrap items-center gap-1 text-[10px] font-semibold tracking-wide text-zinc-800 uppercase",
        )}
      >
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
        <span
          className={cn(
            geistMono.className,
            "inline-flex items-center rounded bg-primary px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-white",
          )}
        >
          {data?.event}
        </span>
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
      <CustomHandle
        type="target"
        position={Position.Bottom}
        id="character"
        style={{
          background: "lightgray",
        }}
      />
    </div>
  );
}
