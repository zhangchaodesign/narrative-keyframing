"use client";

import React from "react";
import { geistMono } from "@/app/fonts";
import { cn } from "@/lib/utils";
import type { TimelineItem } from "@/lib/types/timeline";
import { TIMELINE_LABEL_WIDTH } from "@/components/TimelineView/constants";

interface FixedTimelineItemProps {
  item: TimelineItem;
  timeToPixel: (position: number) => number;
  timelineScale: number;
  color: string;
}

export function TimelineItem({
  item,
  timeToPixel,
  timelineScale,
  color,
}: FixedTimelineItemProps) {
  const itemWidth = timelineScale;
  const itemLeft = timeToPixel(item.position) - TIMELINE_LABEL_WIDTH;

  return (
    <div
      className={cn(
        "absolute top-1 bottom-1 rounded border-2 overflow-hidden",
        `border-${color}-500 bg-${color}-100`,
      )}
      style={{
        left: `${itemLeft}px`,
        width: `${itemWidth - 4}px`,
      }}
    >
      {/* Content */}
      <div className="p-2 h-full overflow-auto">
        <div
          className={cn(
            geistMono.className,
            "text-xs leading-relaxed text-gray-900",
          )}
        >
          {item.content}
        </div>
      </div>
    </div>
  );
}
