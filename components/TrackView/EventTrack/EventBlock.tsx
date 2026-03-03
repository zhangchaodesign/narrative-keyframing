"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
} from "react";
import { cn } from "@/lib/utiils/sharedUtils";
import { geistMono } from "@/app/fonts";
import type { TimelineItem } from "@/lib/types/timeline";
import { TIMELINE_LABEL_WIDTH } from "@/components/TrackView/constants";
import { useWorkflowStore } from "@/lib/stores/workflowStore";

interface EventBlockProps {
  item: TimelineItem;
  timeToPixel: (position: number) => number;
  timelineScale: number;
}

export function EventBlock({
  item,
  timeToPixel,
  timelineScale,
}: EventBlockProps) {
  const [draftContent, setDraftContent] = useState(item.content);
  const setNodes = useWorkflowStore((state) => state.setNodes);

  useEffect(() => {
    setDraftContent(item.content);
  }, [item.content]);

  const safeWidth = Math.max(timelineScale - 8, 20);
  const itemWidth = Math.min(safeWidth, timelineScale);
  const leftPosition = timeToPixel(item.position) - TIMELINE_LABEL_WIDTH;

  const handleContentChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => {
      const nextValue = event.target.value;
      setDraftContent(nextValue);
      setNodes((nodes) =>
        nodes.map((node) => {
          if (node.id !== item.nodeId || node.type !== "event") {
            return node;
          }

          const currentData = (node.data ?? {}) as {
            description?: string;
            timeline?: string;
          };

          return {
            ...node,
            data: {
              ...currentData,
              description: nextValue,
              timeline: currentData?.timeline ?? "",
            },
          };
        }),
      );
    },
    [item.nodeId, setNodes],
  );

  const headerLabel = useMemo(
    () => `Event ${item.position + 1}`,
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
      <div className="group relative flex h-full rounded-lg border-2 border-gray-500 bg-white/95 px-3 py-2 text-xs text-gray-800 transition-shadow hover:shadow-lg">
        <div className="flex w-full flex-col">
          <div
            className={cn(
              geistMono.className,
              "flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-gray-800",
            )}
          >
            <span aria-hidden="true">📜</span>
            <span>{headerLabel}</span>
          </div>
          <textarea
            value={draftContent}
            onChange={handleContentChange}
            placeholder="Describe the event..."
            rows={3}
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
            className="mt-2 w-full flex-1 resize-none rounded border border-gray-300 bg-white/80 px-2 py-1 text-[11px] leading-snug text-gray-800 outline-none focus:border-gray-500 focus:bg-white focus:ring-1 focus:ring-gray-400 nodrag nopan"
          />
        </div>
      </div>
    </div>
  );
}
