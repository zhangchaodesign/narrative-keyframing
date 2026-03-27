"use client";

import {
  useCallback,
  useState,
  type ChangeEvent,
  type FocusEvent,
} from "react";
import { cn } from "@/lib/utiils/sharedUtils";
import { getCharacterColors } from "@/components/shared/colors.constants";
import { geistMono } from "@/app/fonts";
import { PerspectiveBlock } from "@/components/TrackView/CharacterTrack/PerspectiveBlock";
import { CharacterBlock } from "@/components/TrackView/CharacterTrack/CharacterBlock";
import { PerspectiveTrackMenu } from "@/components/TrackView/CharacterTrack/PerspectiveTrackMenu";
import { AddCharacterButton } from "@/components/shared/CharacterSnapshotButton";
import { TbChevronDown, TbChevronRight } from "react-icons/tb";
import type { TimelineTrack } from "@/lib/types/timeline";
import {
  TIMELINE_LABEL_WIDTH,
  TIMELINE_LEFT_PADDING,
  TIMELINE_CHARACTER_HEADER_HEIGHT,
  TIMELINE_CHARACTER_SUBTRACK_HEIGHT,
} from "@/components/TrackView/constants";
import { useWorkflowStore } from "@/lib/stores/workflowStore";
import type {
  CharacterNodeType,
  PerspectiveNodeType,
} from "@/lib/types/workflow";
import { createCharacterSnapshotFromPerspective } from "@/lib/utiils/characterUtils";
import { eventTracker } from "@/lib/utils";

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

  const [collapsed, setCollapsed] = useState(false);

  const perspectiveGroupId = tracks[0]?.parentTrackId;

  const handleCharacterNameChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const nextName = event.target.value;
      if (!perspectiveGroupId) return;

      setNodes((currentNodes) =>
        currentNodes.map((node) => {
          if (
            node.id === perspectiveGroupId &&
            node.type === "perspectiveGroup"
          ) {
            const groupData = node.data ?? {};
            if (
              (groupData as { characterName?: string }).characterName ===
              nextName
            ) {
              return node;
            }
            return {
              ...node,
              data: {
                ...groupData,
                characterName: nextName,
                label: nextName ? `${nextName}'s Perspective` : "Character Arc",
              },
            } as typeof node;
          }

          if (
            node.parentId === perspectiveGroupId &&
            node.type === "character"
          ) {
            const characterNode = node as CharacterNodeType;
            if (characterNode.data?.name === nextName) {
              return characterNode;
            }
            return {
              ...characterNode,
              data: {
                ...characterNode.data,
                name: nextName,
              },
            };
          }

          if (
            node.parentId === perspectiveGroupId &&
            node.type === "perspective"
          ) {
            const perspectiveNode = node as PerspectiveNodeType;
            if (perspectiveNode.data?.narrator === nextName) {
              return perspectiveNode;
            }
            return {
              ...perspectiveNode,
              data: {
                ...perspectiveNode.data,
                narrator: nextName,
              },
            };
          }

          return node;
        }),
      );
    },
    [perspectiveGroupId, setNodes],
  );

  const handleNameInputFocus = useCallback(
    (_event: FocusEvent<HTMLInputElement>) => {
      eventTracker({
        action: "narrator_input_active",
        data: {
          clusterLabel: `${characterName}'s Perspective`,
          narratorName: characterName,
          perspectiveGroupId: perspectiveGroupId ?? "",
        },
      });
    },
    [characterName, perspectiveGroupId],
  );

  const handleNameInputBlur = useCallback(
    (event: FocusEvent<HTMLInputElement>) => {
      eventTracker({
        action: "narrator_input_not_active",
        data: {
          clusterLabel: `${characterName}'s Perspective`,
          narratorName: event.target.value ?? "",
          perspectiveGroupId: perspectiveGroupId ?? "",
        },
      });
    },
    [characterName, perspectiveGroupId],
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
            "absolute left-0 top-0 h-full border-r border-gray-200 flex items-center z-10 bg-gray-50/50",
          )}
          style={{ width: TIMELINE_LABEL_WIDTH }}
        >
          <div className="flex items-center gap-1 px-1 w-full">
            <input
              type="text"
              value={characterName}
              onChange={handleCharacterNameChange}
              onFocus={handleNameInputFocus}
              onBlur={handleNameInputBlur}
              className={cn(
                geistMono.className,
                "rounded px-1 py-0.5 text-xs font-bold text-white text-center flex-1 min-w-0",
                "border border-white/30 outline-none bg-black/10",
                "focus:text-gray-900 focus:bg-white focus:border-gray-300 focus:ring-2 focus:ring-gray-500",
                colors.label,
              )}
            />
          </div>
        </div>
        <button
          onClick={() => setCollapsed((prev) => !prev)}
          className="absolute top-0 h-full flex items-center justify-center hover:bg-gray-100 text-gray-800 hover:text-gray-900 transition-colors"
          style={{ left: TIMELINE_LABEL_WIDTH, width: TIMELINE_LEFT_PADDING }}
        >
          {collapsed ? (
            <TbChevronRight size={16} />
          ) : (
            <TbChevronDown size={16} />
          )}
        </button>
      </div>

      {/* Character Subtrack */}
      {!collapsed && characterTrack && (
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
      {!collapsed && perspectiveTrack && (
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
