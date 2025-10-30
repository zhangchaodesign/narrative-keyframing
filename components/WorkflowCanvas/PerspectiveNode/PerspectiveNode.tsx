"use client";

import { useCallback, useEffect, useMemo, type ReactNode } from "react";
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
import { cn } from "@/lib/utils";
import { geistMono } from "@/app/fonts";
import {
  buildEvidenceAttributeKey,
  useWorkflowStore,
} from "@/lib/stores/workflowStore";

const CHARACTER_VERTICAL_GAP = 210;
const DEFAULT_NARRATION_GROUP_ID = "perspective-group";
const ANALYZING_EVIDENCE_MESSAGE = "Analyzing evidence...";
const READY_TO_ANALYZE_MESSAGE = "Ready to analyze evidence.";
const NEED_REFLECTION_MESSAGE = "Add a reflection to analyze evidence.";
const ANALYSIS_FAILED_MESSAGE = "Evidence analysis failed. Try again.";
const NO_CHARACTERS_MESSAGE = "No characters available to analyze.";
const NO_EVIDENCE_FOUND_MESSAGE = "No supporting evidence found.";

export function PerspectiveNode({ id, data }: NodeProps<PerspectiveNodeType>) {
  const { setNodes, setEdges, getNode } = useReactFlow<
    WorkflowNode,
    WorkflowEdge
  >();
  const edges = useStore((store) => store.edges);
  const nodes = useStore((store) => store.nodes);
  const isLoading = data?.isLoading ?? false;
  const isAnalyzingEvidence = data?.isAnalyzingEvidence ?? false;
  const analysisStatus = data?.analysisStatus ?? "idle";
  const analysisStatusMessage = data?.analysisStatusMessage?.trim();
  const hasReflectionContent = Boolean(data?.reflection?.trim());
  const selectedEvidenceAttributes = useWorkflowStore(
    (state) => state.selectedEvidenceAttributes,
  );
  const highlightedReflection = useMemo<ReactNode>(() => {
    const reflectionText = data?.reflection ?? "";
    if (!reflectionText) {
      return null;
    }

    const analysisItems = data?.analysisEvidence ?? [];
    const activeKeys = selectedEvidenceAttributes;
    if (
      analysisItems.length === 0 ||
      !activeKeys ||
      Object.keys(activeKeys).length === 0
    ) {
      return reflectionText;
    }

    const ranges: Array<{ start: number; end: number }> = [];

    analysisItems.forEach((entry) => {
      const characterId = entry.characterId;
      entry.items.forEach((item) => {
        const shouldHighlight = item.attributes.some((attribute) =>
          Boolean(
            activeKeys[buildEvidenceAttributeKey(characterId, attribute)],
          ),
        );

        if (!shouldHighlight) {
          return;
        }

        const snippet = item.text;
        if (!snippet || snippet.trim().length === 0) {
          return;
        }

        let searchIndex = 0;
        const snippetLength = snippet.length;
        while (searchIndex <= reflectionText.length - snippetLength) {
          const matchIndex = reflectionText.indexOf(snippet, searchIndex);
          if (matchIndex === -1) {
            break;
          }
          ranges.push({ start: matchIndex, end: matchIndex + snippetLength });
          searchIndex = matchIndex + snippetLength;
        }
      });
    });

    if (ranges.length === 0) {
      return reflectionText;
    }

    ranges.sort((a, b) => a.start - b.start || a.end - b.end);
    const merged: Array<{ start: number; end: number }> = [];
    ranges.forEach((range) => {
      const last = merged[merged.length - 1];
      if (!last || range.start > last.end) {
        merged.push({ ...range });
      } else if (range.end > last.end) {
        last.end = range.end;
      }
    });

    const segments: ReactNode[] = [];
    let cursor = 0;

    merged.forEach((range, index) => {
      if (range.start > cursor) {
        segments.push(
          <span key={`segment-${index}-text`}>
            {reflectionText.slice(cursor, range.start)}
          </span>,
        );
      }

      segments.push(
        <mark
          key={`segment-${index}-highlight`}
          className="rounded bg-yellow-200 px-0.5 py-0.5 text-zinc-900"
        >
          {reflectionText.slice(range.start, range.end)}
        </mark>,
      );
      cursor = range.end;
    });

    if (cursor < reflectionText.length) {
      segments.push(
        <span key="segment-tail">{reflectionText.slice(cursor)}</span>,
      );
    }

    return segments;
  }, [data?.analysisEvidence, data?.reflection, selectedEvidenceAttributes]);

  const hasDirectCharacter = useMemo(() => {
    const characterNode = nodes.find(
      (node) => node.data?.perspectiveId === id && node.type === "character",
    ) as CharacterNodeType | undefined;

    return Boolean(characterNode);
  }, [id, nodes]);

  // Find the event node and its timeline
  const eventTimeline = useMemo(() => {
    if (!data?.eventId) {
      return null;
    }
    const eventNode = nodes.find(
      (node) => node.id === data.eventId && node.type === "event",
    ) as EventNodeType | undefined;
    return eventNode?.data?.timeline ?? data.eventId;
  }, [data?.eventId, nodes]);

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
    <div className="group relative flex gap-2 h-48 w-64 flex-col rounded-lg border-2 border-secondary bg-white p-3 text-xs hover:shadow-lg">
      {isLoading && (
        <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center rounded-lg bg-white/80 backdrop-blur-sm">
          <span className="loading loading-spinner text-secondary"></span>
          <span className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-secondary">
            Preparing perspective...
          </span>
        </div>
      )}
      <PerspectiveMenu nodeId={id} />
      <div
        className={cn(
          geistMono.className,
          "flex flex-col w-full gap-1 text-[10px] font-semibold tracking-wide text-zinc-800 uppercase",
        )}
      >
        <span className="flex items-center">💬 Perspective</span>
        {(() => {
          let labelText: string;
          let labelClass = "text-zinc-400";

          if (isAnalyzingEvidence) {
            labelText = ANALYZING_EVIDENCE_MESSAGE;
            labelClass = "text-blue-600";
          } else if (analysisStatus === "success") {
            labelText = analysisStatusMessage ?? READY_TO_ANALYZE_MESSAGE;
            labelClass = "text-green-600";
          } else if (analysisStatus === "error") {
            labelText = analysisStatusMessage ?? ANALYSIS_FAILED_MESSAGE;
            labelClass = "text-red-600";
          } else if (!hasReflectionContent) {
            labelText = NEED_REFLECTION_MESSAGE;
          } else if (analysisStatusMessage) {
            labelText = analysisStatusMessage;
            if (
              analysisStatusMessage === NO_CHARACTERS_MESSAGE ||
              analysisStatusMessage === NO_EVIDENCE_FOUND_MESSAGE
            ) {
              labelClass = "text-amber-600";
            }
          } else {
            labelText = READY_TO_ANALYZE_MESSAGE;
          }

          return (
            <div
              className={cn(
                geistMono.className,
                "text-[9px] font-medium uppercase tracking-wide",
                labelClass,
              )}
            >
              {labelText}
            </div>
          );
        })()}
      </div>

      <div
        className="flex-1 overflow-y-auto w-full resize-none rounded bg-zinc-50 px-2 py-1 text-[10px] leading-snug text-zinc-800"
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
        {highlightedReflection}
      </div>
      {eventTimeline && (
        <div className="mt-1 flex gap-2">
          <span
            className={cn(
              geistMono.className,
              "inline-flex items-center rounded bg-pink-500 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-white",
            )}
            title={`Event: ${data?.eventId}`}
          >
            {eventTimeline}
          </span>
        </div>
      )}
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
