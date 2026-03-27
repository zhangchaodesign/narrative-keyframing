"use client";

import React from "react";
import { cn } from "@/lib/utiils/sharedUtils";
import { geistMono } from "@/app/fonts";
import { NarrativeBlock } from "@/components/TrackView/NarrativeTrack/NarrativeBlock";
import { NarrativeTrackMenu } from "@/components/TrackView/NarrativeTrack/NarrativeTrackMenu";
import type { TimelineTrack } from "@/lib/types/timeline";
import {
  TIMELINE_LABEL_WIDTH,
  TIMELINE_NARRATIVE_TRACK_HEIGHT,
} from "@/components/TrackView/constants";

interface NarrativeTrackProps {
  track: TimelineTrack;
  timeToPixel: (position: number) => number;
  pixelToTime: (pixel: number) => number;
  snapTime: (time: number) => number;
  timelineScale: number;
}

export function NarrativeTrack({
  track,
  timeToPixel,
  timelineScale,
}: NarrativeTrackProps) {
  return (
    <div
      className="sticky top-0 z-50 border-b border-gray-200"
      style={{ height: TIMELINE_NARRATIVE_TRACK_HEIGHT }}
    >
      {/* Track Label */}
      <div
        className="absolute left-0 top-0 h-full bg-green-50 border-r border-gray-200 flex items-center justify-center z-10"
        style={{ width: TIMELINE_LABEL_WIDTH }}
      >
        <div className="flex flex-col items-center gap-1 px-2">
          <span
            className={cn(
              geistMono.className,
              "text-xs font-semibold text-green-600 text-center",
            )}
          >
            Narrative
          </span>
          <NarrativeTrackMenu track={track} />
        </div>
      </div>

      {/* Track Content */}
      <div
        className="absolute top-0 right-0 h-full bg-green-50/50"
        style={{ left: TIMELINE_LABEL_WIDTH }}
      >
        {track.items.map((item) => (
          <NarrativeBlock
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
