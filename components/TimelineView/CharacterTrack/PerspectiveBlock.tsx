"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
} from "react";
import { cn } from "@/lib/utils";
import { geistMono } from "@/app/fonts";
import type { TimelineItem } from "@/lib/types/timeline";
import type { PerspectiveNodeType } from "@/lib/types/workflow";
import { TIMELINE_LABEL_WIDTH } from "@/components/TimelineView/constants";
import { useWorkflowStore } from "@/lib/stores/workflowStore";

interface PerspectiveBlockProps {
  item: TimelineItem;
  timeToPixel: (position: number) => number;
  timelineScale: number;
}

export function PerspectiveBlock({
  item,
  timeToPixel,
  timelineScale,
}: PerspectiveBlockProps) {
  const setNodes = useWorkflowStore((state) => state.setNodes);
  const [draftReflection, setDraftReflection] = useState(item.content);

  useEffect(() => {
    setDraftReflection(item.content);
  }, [item.content]);

  const safeWidth = Math.max(timelineScale - 8, 24);
  const itemWidth = Math.min(safeWidth, timelineScale);
  const leftPosition = timeToPixel(item.position) - TIMELINE_LABEL_WIDTH;

  const handleReflectionChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => {
      const nextValue = event.target.value;
      setDraftReflection(nextValue);
      setNodes((nodes) =>
        nodes.map((node) => {
          if (node.id !== item.nodeId || node.type !== "perspective") {
            return node;
          }

          const currentData = node.data as
            | PerspectiveNodeType["data"]
            | undefined;
          if (!currentData) {
            return node;
          }

          return {
            ...node,
            data: {
              ...currentData,
              reflection: nextValue,
              analysisEvidence: [],
              analysisStatus: "idle",
              analysisStatusMessage: undefined,
            },
          };
        }),
      );
    },
    [item.nodeId, setNodes],
  );

  const title = useMemo(
    () => `Perspective ${item.position + 1}`,
    [item.position],
  );

  return (
    <div
      className="absolute top-1 bottom-1"
      style={{
        left: `${leftPosition}px`,
        width: `${itemWidth}px`,
      }}
    >
      <div className="group relative flex h-full flex-col rounded-lg border-2 border-secondary bg-white/95 px-3 py-2 text-xs text-zinc-800 transition-shadow hover:shadow-lg">
        <div
          className={cn(
            geistMono.className,
            "flex flex-col gap-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-800",
          )}
        >
          <span className="flex items-center gap-1" aria-hidden="true">
            <span>💬</span>
            <span>{title}</span>
          </span>
          <span className="text-[9px] font-medium tracking-wide text-secondary">
            Aligned with workflow canvas reflection
          </span>
        </div>
        <textarea
          value={draftReflection}
          onChange={handleReflectionChange}
          placeholder="Write the reflection..."
          rows={4}
          onPointerDown={(event) => {
            event.stopPropagation();
          }}
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
          className="mt-2 w-full flex-1 resize-none rounded border border-zinc-300 bg-white/80 px-2 py-1 text-[11px] leading-snug text-zinc-800 outline-none focus:border-zinc-500 focus:bg-white focus:ring-1 focus:ring-zinc-400 nodrag nopan"
        />
      </div>
    </div>
  );
}
