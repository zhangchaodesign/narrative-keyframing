"use client";

import React, { useEffect, useRef, useCallback, useMemo } from "react";
import { useWorkflowStore } from "@/lib/stores/workflowStore";
import { TimelineRuler } from "@/components/TrackView/TimelineRuler";
import { EventTrack } from "@/components/TrackView/EventTrack/EventTrack";
import { CharacterTrack } from "@/components/TrackView/CharacterTrack/CharacterTrack";
import { NarrativeTrack } from "@/components/TrackView/NarrativeTrack/NarrativeTrack";
import {
  TIMELINE_LABEL_WIDTH,
  TIMELINE_LEFT_PADDING,
  TIMELINE_RIGHT_PADDING,
  TIMELINE_RULER_HEIGHT,
  TIMELINE_UNIT_WIDTH,
} from "@/components/TrackView/constants";
import { buildTimelineData } from "@/lib/utiils/timelineUtils";

export function TimelineView() {
  const nodes = useWorkflowStore((state) => state.nodes);
  const { storyTrack, characterTracks, narrativeTrack, maxPosition } = useMemo(
    () => buildTimelineData(nodes),
    [nodes],
  );
  const snapToGrid = true;
  const totalDuration = storyTrack ? storyTrack.items.length : maxPosition;

  const timelineRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = React.useState(0);

  // Measure container width
  useEffect(() => {
    const updateWidth = () => {
      if (timelineRef.current) {
        setContainerWidth(timelineRef.current.offsetWidth);
      }
    };

    updateWidth();
    window.addEventListener("resize", updateWidth);
    return () => window.removeEventListener("resize", updateWidth);
  }, []);

  // Calculate timeline width based on fixed spacing
  const timelineScale = TIMELINE_UNIT_WIDTH;
  const timelineUnits = Math.max(
    1,
    Math.ceil(totalDuration),
    (maxPosition ?? 0) + 1,
  );
  const targetTimelineWidth =
    TIMELINE_LABEL_WIDTH +
    TIMELINE_LEFT_PADDING +
    TIMELINE_RIGHT_PADDING +
    timelineUnits * timelineScale;
  const timelineWidth = Math.max(containerWidth, targetTimelineWidth);

  // Convert time to pixel position
  const timeToPixel = useCallback(
    (time: number) => {
      return (
        TIMELINE_LABEL_WIDTH + TIMELINE_LEFT_PADDING + time * timelineScale
      );
    },
    [timelineScale],
  );

  // Convert pixel position to time
  const pixelToTime = useCallback(
    (pixel: number) => {
      return Math.max(
        0,
        (pixel - TIMELINE_LABEL_WIDTH - TIMELINE_LEFT_PADDING) / timelineScale,
      );
    },
    [timelineScale],
  );

  // Snap time to grid if enabled
  const snapTime = useCallback(
    (time: number) => {
      if (!snapToGrid) return time;
      return Math.round(time * 2) / 2; // Snap to half-unit grid
    },
    [snapToGrid],
  );

  // Group character tracks by character
  const groupedCharacterTracks = characterTracks.reduce((acc, track) => {
    const charName = track.characterName || "Unknown";
    if (!acc[charName]) {
      acc[charName] = [];
    }
    acc[charName].push(track);
    return acc;
  }, {} as Record<string, typeof characterTracks>);

  return (
    <div className="h-full bg-white flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-gray-50 border-b border-gray-200">
        <div className="px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
            Timeline Overview
          </div>
        </div>
      </div>

      {/* Timeline Container */}
      <div
        ref={timelineRef}
        className="flex-1 overflow-auto bg-white timeline-container no-scrollbar"
        style={{
          width: "100%",
          cursor: "default",
        }}
      >
        <div
          className="relative h-full"
          style={{
            width: `${timelineWidth}px`,
            minHeight: "100%",
          }}
        >
          {/* Time Ruler */}
          <TimelineRuler
            totalDuration={totalDuration}
            timeToPixel={timeToPixel}
          />

          {/* Story Track */}
          {storyTrack && (
            <EventTrack
              track={storyTrack}
              timeToPixel={timeToPixel}
              pixelToTime={pixelToTime}
              snapTime={snapTime}
              timelineScale={timelineScale}
            />
          )}

          {/* Character Perspective Tracks - Grouped by character */}
          {Object.entries(groupedCharacterTracks).map(
            ([characterName, tracks]) => (
              <CharacterTrack
                key={characterName}
                characterName={characterName}
                tracks={tracks}
                timeToPixel={timeToPixel}
                pixelToTime={pixelToTime}
                snapTime={snapTime}
                timelineScale={timelineScale}
              />
            ),
          )}

          {/* Narrative Cluster Track */}
          {narrativeTrack && (
            <NarrativeTrack
              track={narrativeTrack}
              timeToPixel={timeToPixel}
              pixelToTime={pixelToTime}
              snapTime={snapTime}
              timelineScale={timelineScale}
            />
          )}

          {/* Grid Lines */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ top: TIMELINE_RULER_HEIGHT }}
          >
            {Array.from({ length: Math.ceil(totalDuration) + 1 }, (_, i) => (
              <div
                key={i}
                className="absolute top-0 w-px bg-gray-300 opacity-30"
                style={{
                  left: `${timeToPixel(i)}px`,
                  height: "100%",
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="shrink-0 bg-gray-50 border-t border-gray-200 px-4 py-2">
        <div className="flex items-center justify-between text-xs text-gray-600">
          <div className="flex items-center gap-4">
            <span>
              💡 Timeline view with vertical alignment based on workflow
              connections
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
