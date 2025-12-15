"use client";

import React, { useCallback, useMemo } from "react";
import { cn } from "@/lib/utiils/sharedUtils";
import { geistMono } from "@/app/fonts";
import type { TimelineItem } from "@/lib/types/timeline";
import type { NarrativeNodeType } from "@/lib/types/workflow";
import { TIMELINE_LABEL_WIDTH } from "@/components/TrackView/constants";
import { useWorkflowStore } from "@/lib/stores/workflowStore";
import { NarrativeContent } from "@/components/shared/NarrativeContent";

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
      <div className="group relative flex h-full flex-col rounded-lg border-2 border-primary bg-white text-xs text-zinc-800 transition-shadow hover:shadow-lg">
        {isLoading && (
          <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center rounded-lg bg-white/80 backdrop-blur-sm">
            <span className="loading loading-spinner text-green-600"></span>
            <span className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-green-600">
              Preparing narration...
            </span>
          </div>
        )}
        <div className="flex flex-1 flex-col gap-2 p-3 min-h-0">
          <div
            className={cn(
              geistMono.className,
              "flex flex-col gap-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-800",
            )}
          >
            <span className="flex items-center gap-1" aria-hidden="true">
              <span>📖</span>
              <span>Narration {narrativeSequence}</span>
            </span>
          </div>
          <NarrativeContent
            narration={narrationText}
            snippetUsages={narrativeData?.snippetUsages}
          />
        </div>
      </div>
    </div>
  );
}
