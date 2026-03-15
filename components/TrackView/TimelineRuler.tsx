"use client";

import React from "react";
import { cn } from "@/lib/utiils/sharedUtils";
import { geistMono } from "@/app/fonts";
import {
  TIMELINE_LABEL_WIDTH,
  TIMELINE_RULER_HEIGHT,
} from "@/components/TrackView/constants";

interface TimelineRulerProps {
  totalDuration: number;
  timeToPixel: (time: number) => number;
  stickyTop?: number;
}

export function TimelineRuler({
  totalDuration,
  timeToPixel,
  stickyTop = 0,
}: TimelineRulerProps) {
  const majorTicks = Array.from(
    { length: Math.ceil(totalDuration) + 1 },
    (_, i) => i,
  );

  return (
    <div
      className="sticky z-40 bg-gray-50 border-b-2 border-gray-200"
      style={{ height: TIMELINE_RULER_HEIGHT, top: stickyTop }}
    >
      {/* Track Labels Area */}
      <div
        className="absolute left-0 top-0 h-full bg-gray-50 border-r border-gray-200 flex items-center justify-center text-xs font-medium text-gray-700"
        style={{ width: TIMELINE_LABEL_WIDTH }}
      ></div>

      {/* Ruler Area */}
      <div
        className="top-0 right-0 h-full bg-gray-50 relative overflow-hidden"
        style={{ marginLeft: TIMELINE_LABEL_WIDTH }}
      >
        {/* Major ticks (every 1 unit) */}
        {majorTicks.map((tick) => {
          const tickPosition = timeToPixel(tick) - TIMELINE_LABEL_WIDTH;
          return (
            <div key={`major-${tick}`} className="absolute top-0 bottom-0">
              <div
                className="absolute w-px bg-gray-400 h-3 z-50"
                style={{ left: `${tickPosition}px` }}
              />
              <div
                className={cn(
                  geistMono.className,
                  "absolute text-xs text-gray-700 mt-3.5",
                )}
                style={{
                  left: `${tickPosition}px`,
                  transform: "translateX(-50%)",
                }}
              >
                {tick}
              </div>
            </div>
          );
        })}

        {/* Half-unit ticks (every 0.5 units) */}
        {majorTicks.map((tick) => {
          const halfTickPosition =
            timeToPixel(tick + 0.5) - TIMELINE_LABEL_WIDTH;
          return (
            <div
              key={`half-${tick + 0.5}`}
              className="absolute top-0 w-px bg-gray-300 h-2"
              style={{ left: `${halfTickPosition}px` }}
            />
          );
        })}
      </div>
    </div>
  );
}
