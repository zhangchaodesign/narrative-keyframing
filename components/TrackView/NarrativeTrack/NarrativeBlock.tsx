"use client";

import React, { useCallback, useMemo, useState } from "react";
import { cn } from "@/lib/utiils/sharedUtils";
import { geistMono } from "@/app/fonts";
import type { TimelineItem } from "@/lib/types/timeline";
import type { NarrativeNodeType } from "@/lib/types/workflow";
import { TIMELINE_LABEL_WIDTH } from "@/components/TrackView/constants";
import { useWorkflowStore } from "@/lib/stores/workflowStore";
import { NarrativeContent } from "@/components/shared/NarrativeContent";
import { NarrativeNodeMenu } from "@/components/shared/NarrativeNodeMenu";

interface NarrativeBlockProps {
  item: TimelineItem;
  timeToPixel: (position: number) => number;
  timelineScale: number;
}

export function NarrativeBlock({
  item,
  timeToPixel,
  timelineScale,
}: NarrativeBlockProps) {
  const nodes = useWorkflowStore((state) => state.nodes);
  const narrativeNode = useWorkflowStore(
    useCallback(
      (state) =>
        state.nodes.find(
          (node): node is NarrativeNodeType =>
            node.id === item.nodeId && node.type === "narrative",
        ) ?? null,
      [item.nodeId],
    ),
  );
  const narrativeData = narrativeNode?.data as
    | NarrativeNodeType["data"]
    | undefined;
  const isLoading = narrativeData?.isLoading ?? false;
  const narrationText = narrativeData?.narration ?? item.content;

  const setNodes = useWorkflowStore((state) => state.setNodes);

  const [isEditing, setIsEditing] = useState(false);
  const handleToggleEdit = useCallback(() => {
    setIsEditing((prev) => !prev);
  }, []);

  const handleNarrationChange = useCallback(
    (newNarration: string) => {
      setNodes((prev) =>
        prev.map((node) => {
          if (node.id !== item.nodeId || node.type !== "narrative") return node;
          return {
            ...node,
            data: {
              ...(node.data as NarrativeNodeType["data"]),
              narration: newNarration,
            },
          } as typeof node;
        }),
      );
    },
    [item.nodeId, setNodes],
  );

  const safeWidth = Math.max(timelineScale - 8, 24);
  const itemWidth = Math.min(safeWidth, timelineScale);
  const leftPosition = timeToPixel(item.position) - TIMELINE_LABEL_WIDTH;

  const narrativeSequence = useMemo(() => {
    if (!nodes || nodes.length === 0) {
      return item.position + 1;
    }
    const narrativeNodes = nodes
      .filter(
        (node): node is NarrativeNodeType =>
          node.type === "narrative" &&
          node.parentId === narrativeNode?.parentId,
      )
      .sort((a, b) => a.position.x - b.position.x);
    const index = narrativeNodes.findIndex((node) => node.id === item.nodeId);
    if (index >= 0) {
      return index + 1;
    }
    return item.position + 1;
  }, [item.nodeId, item.position, narrativeNode?.parentId, nodes]);

  return (
    <div
      className="absolute top-1 bottom-1"
      style={{
        left: `${leftPosition}px`,
        width: `${itemWidth}px`,
      }}
    >
      <div className="group relative flex h-full flex-col rounded-lg border-2 border-primary bg-white text-xs text-gray-800 transition-shadow hover:shadow-lg">
        <div className="pointer-events-none absolute -top-12 right-0 z-50 flex items-center gap-1 rounded-lg border border-gray-200 bg-white p-1.5 text-gray-500 shadow-sm opacity-0 transition group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100">
          <NarrativeNodeMenu
            nodeId={item.nodeId}
            narrativeText={narrationText}
            isEditing={isEditing}
            onToggleEdit={handleToggleEdit}
            buttonPadding="p-1.5"
            iconSize={16}
          />
        </div>
        {isLoading && (
          <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center rounded-lg bg-white/80 backdrop-blur-sm">
            <span className="loading loading-spinner text-green-600"></span>
            <span className="mt-2 text-xs font-semibold uppercase tracking-wide text-green-600">
              Preparing enriched story content...
            </span>
          </div>
        )}
        <div className="flex flex-1 flex-col gap-2 p-3 min-h-0">
          <div
            className={cn(
              geistMono.className,
              "flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-gray-800",
            )}
          >
            <span className="flex items-center gap-1" aria-hidden="true">
              <span>📖</span>
              <span>Act {narrativeSequence}</span>
            </span>
          </div>
          <NarrativeContent
            narration={narrationText}
            snippetUsages={narrativeData?.snippetUsages}
            isEditing={isEditing}
            onNarrationChange={handleNarrationChange}
          />
        </div>
      </div>
    </div>
  );
}
