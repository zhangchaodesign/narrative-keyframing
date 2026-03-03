"use client";

import React from "react";
import { cn } from "@/lib/utiils/sharedUtils";
import { geistMono } from "@/app/fonts";
import { EventBlock } from "@/components/TrackView/EventTrack/EventBlock";
import type { TimelineTrack } from "@/lib/types/timeline";
import {
  TIMELINE_LABEL_WIDTH,
  TIMELINE_STORY_TRACK_HEIGHT,
} from "@/components/TrackView/constants";

interface EventTrackProps {
  track: TimelineTrack;
  timeToPixel: (position: number) => number;
  pixelToTime: (pixel: number) => number;
  snapTime: (time: number) => number;
  timelineScale: number;
}

export function EventTrack({
  track,
  timeToPixel,
  timelineScale,
}: EventTrackProps) {
  return (
    <div
      className="relative border-b border-gray-200"
      style={{ height: TIMELINE_STORY_TRACK_HEIGHT }}
    >
      {/* Track Label */}
      <div
        className="absolute left-0 top-0 h-full bg-gray-50 border-r border-gray-200 flex items-center justify-center z-10"
        style={{ width: TIMELINE_LABEL_WIDTH }}
      >
        <div className="flex flex-col items-center gap-1 px-2">
          <span
            className={cn(
              geistMono.className,
              "text-xs font-semibold text-gray-600 text-center",
            )}
          >
            Story Draft
          </span>
        </div>
      </div>

      {/* Track Content */}
      <div
        className="absolute top-0 right-0 h-full bg-gray-50/50"
        style={{ left: TIMELINE_LABEL_WIDTH }}
      >
        {track.items.map((item) => (
          <EventBlock
            key={item.id}
            item={item}
            timeToPixel={timeToPixel}
            timelineScale={timelineScale}
          />
        ))}
      </div>
    </div>
  );
}
