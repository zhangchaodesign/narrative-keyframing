"use client";

import React, { useCallback, useState } from "react";
import { cn } from "@/lib/utiils/sharedUtils";
import { getCharacterColors } from "@/components/shared/colors.constants";
import { geistMono } from "@/app/fonts";
import { PerspectiveBlock } from "@/components/TrackView/CharacterTrack/PerspectiveBlock";
import { CharacterBlock } from "@/components/TrackView/CharacterTrack/CharacterBlock";
import { PerspectiveTrackMenu } from "@/components/TrackView/CharacterTrack/PerspectiveTrackMenu";
import { AddCharacterButton } from "@/components/shared/CharacterSnapshotButton";
import type { TimelineTrack } from "@/lib/types/timeline";
import {
  TIMELINE_LABEL_WIDTH,
  TIMELINE_CHARACTER_HEADER_HEIGHT,
  TIMELINE_CHARACTER_SUBTRACK_HEIGHT,
} from "@/components/TrackView/constants";
import { useWorkflowStore } from "@/lib/stores/workflowStore";
import type {
  CharacterNodeType,
  PerspectiveNodeType,
} from "@/lib/types/workflow";
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
  const colors = getCharacterColors(characterName);
  const perspectiveTrack = tracks.find((t) => t.type === "perspective");
  const characterTrack = tracks.find((t) => t.type === "character");

  const nodes = useWorkflowStore((state) => state.nodes);
  const setNodes = useWorkflowStore((state) => state.setNodes);
  const setEdges = useWorkflowStore((state) => state.setEdges);

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
      const updateFlag = (next: boolean) => {
        setNodes((nodesState) =>
          nodesState.map((node) => {
            if (node.id !== perspectiveNodeId || node.type !== "perspective") {
              return node;
            }
            const existingData = node.data as PerspectiveNodeType["data"];
            return {
              ...node,
              data: {
                ...existingData,
                isCreatingSnapshot: next,
              },
            };
          }),
        );
      };

      updateFlag(true);
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
        updateFlag(false);
      }
    },
    [nodes, setNodes, setEdges, characterName],
  );

  const perspectivesWithoutChars = perspectivesWithoutCharacters();

  // Editable character name
  const [nameValue, setNameValue] = useState(characterName);
  const perspectiveGroupId = tracks[0]?.parentTrackId;

  const handleNameBlur = useCallback(() => {
    const trimmed = nameValue.trim();
    if (!trimmed || trimmed === characterName || !perspectiveGroupId) {
      setNameValue(characterName);
      return;
    }
    setNodes((prev) =>
      prev.map((node) => {
        if (node.id !== perspectiveGroupId) return node;
        return {
          ...node,
          data: {
            ...(node.data as Record<string, unknown>),
            characterName: trimmed,
          },
        } as typeof node;
      }),
    );
  }, [nameValue, characterName, perspectiveGroupId, setNodes]);

  const handleNameKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.currentTarget.blur();
      } else if (e.key === "Escape") {
        setNameValue(characterName);
        e.currentTarget.blur();
      }
    },
    [characterName],
  );

  return (
    <div className="relative border-b border-gray-200">
      {/* Main Track Header */}
      <div
        className="relative"
        style={{ height: TIMELINE_CHARACTER_HEADER_HEIGHT }}
      >
        <div
          className={cn(
            "absolute left-0 top-0 h-full border-r border-gray-200 flex items-center justify-center z-10 bg-gray-50/50",
          )}
          style={{ width: TIMELINE_LABEL_WIDTH }}
        >
          <div className="flex flex-col items-center gap-1 px-2">
            <input
              type="text"
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
              onBlur={handleNameBlur}
              onKeyDown={handleNameKeyDown}
              className={cn(
                geistMono.className,
                "rounded px-2 py-0.5 text-xs font-bold text-white text-center w-full",
                "border border-white/30 outline-none bg-black/10",
                "focus:text-gray-900 focus:bg-white focus:border-gray-300 focus:ring-2 focus:ring-gray-500",
                colors.label,
              )}
              style={{ maxWidth: TIMELINE_LABEL_WIDTH - 16 }}
            />
          </div>
        </div>
        <div
          className={cn("absolute top-0 right-0 h-full bg-gray-50/50")}
          style={{ left: TIMELINE_LABEL_WIDTH }}
        ></div>
      </div>

      {/* Character Subtrack */}
      {characterTrack && (
        <div
          className="relative border-t border-gray-200"
          style={{ height: TIMELINE_CHARACTER_SUBTRACK_HEIGHT }}
        >
          <div
            className={cn(
              "absolute left-0 top-0 h-full border-r border-gray-200 flex items-center justify-center z-10 bg-gray-50/50",
            )}
            style={{ width: TIMELINE_LABEL_WIDTH }}
          >
            <span
              className={cn(
                geistMono.className,
                "text-xs font-semibold text-center",
              )}
            >
              Snapshot
            </span>
          </div>
          <div
            className={cn("absolute top-0 right-0 h-full bg-gray-50/50")}
            style={{ left: TIMELINE_LABEL_WIDTH }}
          >
            {characterTrack.items.map((item) => (
              <CharacterBlock
                key={item.id}
                item={item}
                timeToPixel={timeToPixel}
                timelineScale={timelineScale}
                narratorName={characterName}
              />
            ))}
            {/* Add Character Buttons for perspectives without character snapshots */}
            {perspectivesWithoutChars.map((perspectiveItem) => {
              const safeWidth = Math.max(timelineScale - 8, 24);
              const itemWidth = Math.min(safeWidth, timelineScale);
              const leftPosition =
                timeToPixel(perspectiveItem.position) - TIMELINE_LABEL_WIDTH;
              const perspectiveNode = nodes.find(
                (node): node is PerspectiveNodeType =>
                  node.id === perspectiveItem.nodeId &&
                  node.type === "perspective",
              );
              const isProcessing =
                perspectiveNode?.data?.isCreatingSnapshot ?? false;

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
                      disabled={isProcessing}
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

      {/* Perspective Subtrack */}
      {perspectiveTrack && (
        <div
          className="relative border-t border-gray-200"
          style={{ height: TIMELINE_CHARACTER_SUBTRACK_HEIGHT }}
        >
          <div
            className={cn(
              "absolute left-0 top-0 h-full border-r border-gray-200 flex items-center justify-center z-10 bg-gray-50/50",
            )}
            style={{ width: TIMELINE_LABEL_WIDTH }}
          >
            <div className="flex flex-col gap-2 items-center">
              <span
                className={cn(
                  geistMono.className,
                  "text-xs font-semibold text-center",
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
            className={cn("absolute top-0 right-0 h-full bg-gray-50/50")}
            style={{ left: TIMELINE_LABEL_WIDTH }}
          >
            {perspectiveTrack.items.map((item) => (
              <PerspectiveBlock
                key={item.id}
                item={item}
                timeToPixel={timeToPixel}
                timelineScale={timelineScale}
                characterName={characterName}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
