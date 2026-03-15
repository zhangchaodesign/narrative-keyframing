"use client";

import { useCallback, useMemo, useState } from "react";
import { Position, type NodeProps, useStore } from "@xyflow/react";
import { NarrativeHandle } from "@/components/WorkflowCanvas/NarrativeNode/NarrativeHandle";
import { NarrativeContent } from "@/components/shared/NarrativeContent";
import { NarrativeNodeMenu } from "@/components/shared/NarrativeNodeMenu";
import type {
  EventNodeType,
  NarrativeNodeType,
  ThirdPersonGroupNodeType,
} from "@/lib/types/workflow";
import { cn } from "@/lib/utiils/sharedUtils";
import { geistMono } from "@/app/fonts";
import { useWorkflowStore } from "@/lib/stores/workflowStore";

const DEFAULT_NARRATIVE_GROUP_ID = "narrative-group";

export function NarrativeNode({ id, data }: NodeProps<NarrativeNodeType>) {
  const nodes = useStore((store) => store.nodes);
  const setNodes = useWorkflowStore((state) => state.setNodes);
  const isLoading = data?.isLoading ?? false;
  const [isEditing, setIsEditing] = useState(false);
  const [editedNarration, setEditedNarration] = useState(data?.narration ?? "");

  const handleToggleEdit = useCallback(() => {
    if (isEditing) {
      setNodes((nodesState) =>
        nodesState.map((node) => {
          if (node.id !== id || node.type !== "narrative") {
            return node;
          }
          const existingData = node.data as NarrativeNodeType["data"];
          return {
            ...node,
            data: {
              ...existingData,
              narration: editedNarration,
            },
          };
        }),
      );
      setIsEditing(false);
    } else {
      setEditedNarration(data?.narration ?? "");
      setIsEditing(true);
    }
  }, [data?.narration, editedNarration, id, isEditing, setNodes]);

  const handleNarrationChange = useCallback((nextNarration: string) => {
    setEditedNarration(nextNarration);
  }, []);

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

  // Determine which event group (story draft) this narrative cluster is linked to
  const connectedEventGroup = useMemo(() => {
    const narrativeNode = nodes.find(
      (node): node is NarrativeNodeType =>
        node.id === id && node.type === "narrative",
    );
    const narrativeGroupId =
      narrativeNode?.parentId ?? DEFAULT_NARRATIVE_GROUP_ID;
    const narrativeGroup = nodes.find(
      (node): node is ThirdPersonGroupNodeType =>
        node.type === "narrativeGroup" && node.id === narrativeGroupId,
    );
    return narrativeGroup?.data?.connectedEventGroup;
  }, [id, nodes]);

  // Find the event node and related metadata for display using index-based matching
  const eventMetadata = useMemo(() => {
    const narrativeNode = nodes.find(
      (node): node is NarrativeNodeType =>
        node.id === id && node.type === "narrative",
    );
    if (!narrativeNode) {
      return null;
    }

    const parentGroupId = narrativeNode.parentId;
    if (!parentGroupId) {
      return null;
    }

    // Get all narratives in the same group, sorted by position
    const siblingNarratives = nodes
      .filter(
        (node): node is NarrativeNodeType =>
          node.type === "narrative" && node.parentId === parentGroupId,
      )
      .sort((a, b) => (a.position.x ?? 0) - (b.position.x ?? 0));

    // Find index of current narrative
    const narrativeIndex = siblingNarratives.findIndex(
      (node) => node.id === id,
    );

    if (narrativeIndex < 0) {
      return null;
    }

    // Get all event nodes sorted by position
    const eventNodes = nodes
      .filter((node): node is EventNodeType => node.type === "event")
      .sort((a, b) => (a.position.x ?? 0) - (b.position.x ?? 0));

    // Get event at the same index
    const eventNode =
      eventNodes[Math.min(narrativeIndex, eventNodes.length - 1)];

    const timelineLabel =
      eventNode?.data?.timeline ?? `Act ${narrativeIndex + 1}`;
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
  }, [connectedEventGroup, id, nodes]);

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
      <NarrativeNodeMenu
        nodeId={id}
        narrativeText={isEditing ? editedNarration : data?.narration}
        isEditing={isEditing}
        onToggleEdit={handleToggleEdit}
        wrapperClassName="pointer-events-none absolute -top-9 right-0 flex items-center gap-1 rounded-lg border border-gray-200 bg-white p-1 text-gray-500 shadow-sm opacity-0 transition group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100"
      />
      <div
        className={cn(
          geistMono.className,
          "flex flex-col w-full gap-1 text-[10px] font-semibold tracking-wide text-gray-800 uppercase",
        )}
      >
        <span className="flex items-center">📖 Act {narrativeSequence}</span>
      </div>

      <NarrativeContent
        narration={data?.narration ?? ""}
        snippetUsages={data?.snippetUsages}
        isEditing={isEditing}
        onNarrationChange={handleNarrationChange}
      />
      {eventMetadata && (
        <div className="mt-1 flex justify-end gap-2">
          <span
            className={cn(
              "inline-flex items-center rounded text-[9px] font-semibold tracking-wide text-gray-500",
            )}
            title={`Act: ${eventMetadata.timelineLabel}`}
          >
            {eventMetadata.clusterDisplay
              ? `${eventMetadata.clusterDisplay} / ${eventMetadata.timelineLabel}`
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
