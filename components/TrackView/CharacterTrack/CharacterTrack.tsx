"use client";

import React, { useCallback, useState } from "react";
import { cn } from "@/lib/utiils/sharedUtils";
import { geistMono } from "@/app/fonts";
import { PerspectiveBlock } from "@/components/TrackView/CharacterTrack/PerspectiveBlock";
import { CharacterBlock } from "@/components/TrackView/CharacterTrack/CharacterBlock";
import { PerspectiveTrackMenu } from "@/components/TrackView/CharacterTrack/PerspectiveTrackMenu";
import { AddCharacterButton } from "@/components/shared/AddCharacterButton";
import type { TimelineTrack } from "@/lib/types/timeline";
import {
  TIMELINE_LABEL_WIDTH,
  TIMELINE_CHARACTER_HEADER_HEIGHT,
  TIMELINE_CHARACTER_SUBTRACK_HEIGHT,
} from "@/components/TrackView/constants";
import { useWorkflowStore } from "@/lib/stores/workflowStore";
import type { CharacterNodeType } from "@/lib/types/workflow";
import { createCharacterSnapshotFromPerspective } from "@/lib/utiils/characterUtils";

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

  const nodes = useWorkflowStore((state) => state.nodes);
  const setNodes = useWorkflowStore((state) => state.setNodes);
  const setEdges = useWorkflowStore((state) => state.setEdges);

  // Track which perspectives are currently processing character creation
  const [processingPerspectives, setProcessingPerspectives] = useState<
    Set<string>
  >(new Set());

  // For each perspective, check if it has a character snapshot
  const perspectivesWithoutCharacters = useCallback(() => {
    if (!perspectiveTrack) return [];

    return perspectiveTrack.items.filter((perspectiveItem) => {
      const hasCharacter = nodes.some(
        (node): node is CharacterNodeType =>
          node.type === "character" &&
          node.data?.perspectiveId === perspectiveItem.nodeId,
      );
      return !hasCharacter;
    });
  }, [perspectiveTrack, nodes]);

  // Handler to create character snapshot for a perspective
  const handleCreateCharacter = useCallback(
    async (perspectiveNodeId: string) => {
      setProcessingPerspectives((prev) => new Set(prev).add(perspectiveNodeId));

      try {
        await createCharacterSnapshotFromPerspective({
          perspectiveNodeId,
          nodes,
          fallbackNarratorName: characterName,
          setNodes,
          setEdges,
        });
      } catch (error) {
        console.error("Error creating character snapshot:", error);
      } finally {
        setProcessingPerspectives((prev) => {
          const next = new Set(prev);
          next.delete(perspectiveNodeId);
          return next;
        });
      }
    },
    [nodes, setNodes, setEdges, characterName],
  );

  const perspectivesWithoutChars = perspectivesWithoutCharacters();

  return (
    <div className="relative border-b border-gray-200">
      {/* Main Track Header */}
      <div
        className="relative"
        style={{ height: TIMELINE_CHARACTER_HEADER_HEIGHT }}
      >
        <div
          className="absolute left-0 top-0 h-full bg-gray-50 border-r border-gray-200 flex items-center justify-center z-10"
          style={{ width: TIMELINE_LABEL_WIDTH }}
        >
          <div className="flex flex-col items-center gap-1 px-2">
            <span
              className={cn(
                geistMono.className,
                "text-xs font-semibold text-gray-800 text-center",
              )}
            >
              {characterName}
            </span>
          </div>
        </div>
        <div
          className="absolute top-0 right-0 h-full bg-gray-50"
          style={{ left: TIMELINE_LABEL_WIDTH }}
        ></div>
      </div>

      {/* Perspective Subtrack */}
      {perspectiveTrack && (
        <div
          className="relative border-t border-gray-200 bg-blue-50/50"
          style={{ height: TIMELINE_CHARACTER_SUBTRACK_HEIGHT }}
        >
          <div
            className="absolute left-0 top-0 h-full bg-blue-50 border-r border-gray-200 flex items-center justify-center z-10"
            style={{ width: TIMELINE_LABEL_WIDTH }}
          >
            <div className="flex flex-col gap-2 items-center">
              <span
                className={cn(
                  geistMono.className,
                  "text-xs font-semibold text-blue-600 text-center",
                )}
              >
                Perspective
              </span>
              <PerspectiveTrackMenu
                characterName={characterName}
                perspectiveItems={perspectiveTrack.items}
              />
            </div>
          </div>
          <div
            className="absolute top-0 right-0 h-full bg-blue-50/50"
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
            className="absolute left-0 top-0 h-full bg-amber-50 border-r border-gray-200 flex items-center justify-center z-10"
            style={{ width: TIMELINE_LABEL_WIDTH }}
          >
            <span
              className={cn(
                geistMono.className,
                "text-xs font-semibold text-amber-600 text-center",
              )}
            >
              Snapshot
            </span>
          </div>
          <div
            className="absolute top-0 right-0 h-full bg-amber-50/50"
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
            {/* Add Character Buttons for perspectives without character snapshots */}
            {perspectivesWithoutChars.map((perspectiveItem) => {
              const safeWidth = Math.max(timelineScale - 8, 24);
              const itemWidth = Math.min(safeWidth, timelineScale);
              const leftPosition =
                timeToPixel(perspectiveItem.position) - TIMELINE_LABEL_WIDTH;
              const isProcessing = processingPerspectives.has(
                perspectiveItem.nodeId,
              );

              return (
                <div
                  key={`add-char-${perspectiveItem.id}`}
                  className="group absolute top-1 bottom-1"
                  style={{
                    left: `${leftPosition}px`,
                    width: `${itemWidth}px`,
                  }}
                >
                  <div className="relative h-full w-full">
                    <AddCharacterButton
                      onClick={() =>
                        handleCreateCharacter(perspectiveItem.nodeId)
                      }
                      isProcessing={isProcessing}
                      variant="timeline"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
