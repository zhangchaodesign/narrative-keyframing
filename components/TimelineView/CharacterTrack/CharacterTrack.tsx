"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { geistMono } from "@/app/fonts";
import { PerspectiveBlock } from "@/components/TimelineView/CharacterTrack/PerspectiveBlock";
import { CharacterBlock } from "@/components/TimelineView/CharacterTrack/CharacterBlock";
import { PerspectiveTrackMenu } from "@/components/TimelineView/CharacterTrack/PerspectiveTrackMenu";
import type { TimelineTrack } from "@/lib/types/timeline";
import {
  TIMELINE_LABEL_WIDTH,
  TIMELINE_CHARACTER_HEADER_HEIGHT,
  TIMELINE_CHARACTER_SUBTRACK_HEIGHT,
} from "@/components/TimelineView/constants";

interface CharacterTrackProps {
  characterName: string;
  tracks: TimelineTrack[];
  timeToPixel: (position: number) => number;
  pixelToTime: (pixel: number) => number;
  snapTime: (time: number) => number;
  timelineScale: number;
}

export function CharacterTrack({
  characterName,
  tracks,
  timeToPixel,
  timelineScale,
}: CharacterTrackProps) {
  const perspectiveTrack = tracks.find((t) => t.type === "perspective");
  const characterTrack = tracks.find((t) => t.type === "character");

  return (
    <div className="relative border-b border-gray-200">
      {/* Main Track Header */}
      <div
        className="relative"
        style={{ height: TIMELINE_CHARACTER_HEADER_HEIGHT }}
      >
        <div
          className="absolute left-0 top-0 h-full bg-blue-50 border-r border-gray-200 flex items-center justify-center z-10"
          style={{ width: TIMELINE_LABEL_WIDTH }}
        >
          <div className="flex flex-col items-center gap-1 px-2">
            <span
              className={cn(
                geistMono.className,
                "text-xs font-semibold text-blue-600 text-center",
              )}
            >
              {characterName}
            </span>
          </div>
        </div>
      </div>

      {/* Perspective Subtrack */}
      {perspectiveTrack && (
        <div
          className="relative border-t border-gray-200"
          style={{ height: TIMELINE_CHARACTER_SUBTRACK_HEIGHT }}
        >
          <div
            className="absolute left-0 top-0 h-full bg-gray-50 border-r border-gray-200 flex items-center justify-center z-10"
            style={{ width: TIMELINE_LABEL_WIDTH }}
          >
            <div className="flex items-center">
              <span className={cn(geistMono.className, "text-xs text-gray-600")}>
                Perspective
              </span>
              <PerspectiveTrackMenu
                characterName={characterName}
                perspectiveItems={perspectiveTrack.items}
              />
            </div>
          </div>
          <div
            className="absolute top-0 right-0 h-full bg-blue-50/10"
            style={{ left: TIMELINE_LABEL_WIDTH }}
          >
            {perspectiveTrack.items.map((item) => (
              <PerspectiveBlock
                key={item.id}
                item={item}
                timeToPixel={timeToPixel}
                timelineScale={timelineScale}
              />
            ))}
          </div>
        </div>
      )}

      {/* Character Subtrack */}
      {characterTrack && (
        <div
          className="relative border-t border-gray-200"
          style={{ height: TIMELINE_CHARACTER_SUBTRACK_HEIGHT }}
        >
          <div
            className="absolute left-0 top-0 h-full bg-gray-50 border-r border-gray-200 flex items-center justify-center z-10"
            style={{ width: TIMELINE_LABEL_WIDTH }}
          >
            <span className={cn(geistMono.className, "text-xs text-gray-600")}>
              Snapshot
            </span>
          </div>
          <div
            className="absolute top-0 right-0 h-full bg-purple-50/10"
            style={{ left: TIMELINE_LABEL_WIDTH }}
          >
            {characterTrack.items.map((item) => (
              <CharacterBlock
                key={item.id}
                item={item}
                timeToPixel={timeToPixel}
                timelineScale={timelineScale}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
