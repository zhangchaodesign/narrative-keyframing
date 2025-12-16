"use client";

import { useMemo } from "react";
import { Position, type NodeProps, useStore } from "@xyflow/react";
import { NarrativeHandle } from "@/components/WorkflowCanvas/NarrativeNode/NarrativeHandle";
import { NarrativeContent } from "@/components/shared/NarrativeContent";
import type {
  EventNodeType,
  NarrativeNodeType,
  PerspectiveGroupNodeType,
} from "@/lib/types/workflow";
import { cn } from "@/lib/utiils/sharedUtils";
import { geistMono } from "@/app/fonts";

const DEFAULT_NARRATIVE_GROUP_ID = "narrative-group";

export function NarrativeNode({ id, data }: NodeProps<NarrativeNodeType>) {
  const nodes = useStore((store) => store.nodes);
  const edges = useStore((store) => store.edges);
  const isLoading = data?.isLoading ?? false;

  // Calculate narrative sequence number based on position
  const narrativeSequence = useMemo(() => {
    const currentNode = nodes.find((node) => node.id === id);
    if (!currentNode) return 1;

    const narrativeNodes = nodes
      .filter((node) => node.type === "narrative")
      .filter((node) => node.parentId === currentNode.parentId)
      .sort((a, b) => a.position.x - b.position.x);
    const index = narrativeNodes.findIndex((node) => node.id === id);
    return index >= 0 ? index + 1 : 1;
  }, [id, nodes]);

  // Determine which event group (story outline) this narrative cluster is linked to
  const connectedEventGroup = useMemo(() => {
    const narrativeNode = nodes.find(
      (node): node is NarrativeNodeType =>
        node.id === id && node.type === "narrative",
    );
    const narrativeGroupId =
      narrativeNode?.parentId ?? DEFAULT_NARRATIVE_GROUP_ID;
    const perspectiveBridgeEdge = edges.find(
      (edge) =>
        ((edge.target === narrativeGroupId &&
          edge.targetHandle === "group-bridge") ||
          (edge.source === narrativeGroupId &&
            edge.sourceHandle === "group-bridge")) &&
        (edge.sourceHandle === "narrative-bridge" ||
          edge.targetHandle === "narrative-bridge"),
    );
    if (!perspectiveBridgeEdge) {
      return undefined;
    }

    const perspectiveGroupNode = nodes.find(
      (node): node is PerspectiveGroupNodeType =>
        node.type === "perspectiveGroup" &&
        (node.id === perspectiveBridgeEdge.source ||
          node.id === perspectiveBridgeEdge.target),
    );
    return perspectiveGroupNode?.data?.connectedEventGroup;
  }, [edges, id, nodes]);

  // Find the event node and related metadata for display
  const eventMetadata = useMemo(() => {
    if (!data?.eventId) {
      return null;
    }
    const eventNode = nodes.find(
      (node): node is EventNodeType =>
        node.id === data.eventId && node.type === "event",
    );
    const timelineLabel = eventNode?.data?.timeline ?? data.eventId;
    const clusterLabel = connectedEventGroup?.label?.trim() ?? "";
    const clusterId = connectedEventGroup?.eventGroupId;
    const assembledDisplay = [clusterLabel, clusterId]
      .filter((value) => value !== undefined && value !== "")
      .join(" ")
      .trim();
    const clusterDisplay =
      assembledDisplay.length > 0 ? assembledDisplay : undefined;

    return {
      timelineLabel,
      clusterDisplay,
    };
  }, [connectedEventGroup, data?.eventId, nodes]);

  return (
    <div className="group relative flex gap-2 h-80 w-64 flex-col rounded-lg border-2 border-primary bg-white p-3 text-xs hover:shadow-lg">
      {isLoading && (
        <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center rounded-lg bg-white/80 backdrop-blur-sm">
          <span className="loading loading-spinner text-green-600"></span>
          <span className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-green-600">
            Preparing narration...
          </span>
        </div>
      )}
      <div
        className={cn(
          geistMono.className,
          "flex flex-col w-full gap-1 text-[10px] font-semibold tracking-wide text-zinc-800 uppercase",
        )}
      >
        <span className="flex items-center">
          📖 Narration {narrativeSequence}
        </span>
      </div>

      <NarrativeContent
        narration={data?.narration ?? ""}
        snippetUsages={data?.snippetUsages}
      />
      {eventMetadata && (
        <div className="mt-1 flex gap-2">
          <span
            className={cn(
              geistMono.className,
              "inline-flex items-center rounded bg-pink-500 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-white",
            )}
            title={`Event: ${data?.eventId}`}
          >
            {eventMetadata.clusterDisplay
              ? `${eventMetadata.clusterDisplay}: ${eventMetadata.timelineLabel}`
              : eventMetadata.timelineLabel}
          </span>
        </div>
      )}
      <NarrativeHandle
        type="target"
        position={Position.Left}
        id="narrative-prev"
      />
      <NarrativeHandle
        type="source"
        position={Position.Right}
        id="narrative-next"
      />
    </div>
  );
}
