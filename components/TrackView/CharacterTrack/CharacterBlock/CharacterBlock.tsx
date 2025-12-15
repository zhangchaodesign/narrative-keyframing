"use client";

import {
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
import { TraitSection } from "@/components/shared/TraitSection";
import { CharacterRefreshMenu } from "@/components/shared/CharacterActionsMenu";
import type { CharacterNodeData, CharacterTraits } from "@/lib/types/workflow";
import {
  CHARACTER_TRAIT_CATEGORIES,
  normalizeCharacterTraits,
} from "@/lib/utiils/characterUtils";

interface CharacterBlockProps {
  item: TimelineItem;
  timeToPixel: (position: number) => number;
  timelineScale: number;
}

export function CharacterBlock({
  item,
  timeToPixel,
  timelineScale,
}: CharacterBlockProps) {
  const setNodes = useWorkflowStore((state) => state.setNodes);
  const characterNode = useWorkflowStore(
    useCallback(
      (state) =>
        state.nodes.find(
          (node) => node.id === item.nodeId && node.type === "character",
        ) ?? null,
      [item.nodeId],
    ),
  );

  const characterData = useMemo(
    () => (characterNode?.data as CharacterNodeData | undefined) ?? undefined,
    [characterNode],
  );

  const traits = useMemo<CharacterTraits>(
    () => normalizeCharacterTraits(characterData?.traits),
    [characterData?.traits],
  );

  const characterName = characterData?.name?.trim() ?? "";
  const isRefreshing = Boolean(characterData?.isRefreshing);
  const [nameValue, setNameValue] = useState(characterName);

  useEffect(() => {
    setNameValue(characterName);
  }, [characterName]);

  const safeWidth = Math.max(timelineScale - 8, 24);
  const itemWidth = Math.min(safeWidth, timelineScale);
  const leftPosition = timeToPixel(item.position) - TIMELINE_LABEL_WIDTH;

  const updateCharacterNode = useCallback(
    (
      updater: (
        currentTraits: CharacterTraits,
        currentName: string,
        currentPerspectiveId: string,
      ) => CharacterNodeData,
    ) => {
      setNodes((nodes) =>
        nodes.map((node) => {
          if (node.id !== item.nodeId || node.type !== "character") {
            return node;
          }

          const currentData = node.data as CharacterNodeData | undefined;
          const currentTraits = normalizeCharacterTraits(currentData?.traits);

          return {
            ...node,
            data: {
              ...currentData,
              ...updater(
                currentTraits,
                currentData?.name ?? "",
                currentData?.perspectiveId ?? "",
              ),
            },
          };
        }),
      );
    },
    [item.nodeId, setNodes],
  );

  const handleNameChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const nextValue = event.target.value;
      setNameValue(nextValue);
      updateCharacterNode(
        (currentTraits, _currentName, currentPerspectiveId) => ({
          name: nextValue,
          traits: currentTraits,
          perspectiveId: currentPerspectiveId,
        }),
      );
    },
    [updateCharacterNode],
  );

  const nameInputPlaceholder = characterName ? characterName : "Unknown";

  return (
    <div
      className="absolute top-1 bottom-1"
      style={{
        left: `${leftPosition}px`,
        width: `${itemWidth}px`,
      }}
    >
      <div className="group relative flex h-full flex-col rounded-lg border-2 border-warning bg-white text-xs text-zinc-800 transition-shadow hover:shadow-lg">
        {isRefreshing && (
          <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center rounded-lg bg-white/80 backdrop-blur-sm">
            <span className="loading loading-spinner text-warning"></span>
            <span className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-warning">
              Updating snapshot...
            </span>
          </div>
        )}
        <CharacterRefreshMenu
          nodeId={item.nodeId}
          linkedTooltip={`Refresh ${
            characterName || "character"
          } from perspective`}
          ariaLabelLinked={`Refresh ${
            characterName || "character"
          } from perspective`}
          wrapperClassName="pointer-events-none absolute -top-9 right-0 flex items-center gap-1 rounded-lg border border-warning/40 bg-white p-1 text-zinc-500 shadow-sm opacity-0 transition group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100"
        />
        <div className="flex flex-1 flex-col gap-3 p-3 min-h-0">
          <div
            className={cn(
              geistMono.className,
              "text-[10px] font-semibold uppercase tracking-wide text-zinc-800",
            )}
          >
            🧙 Character Snapshot
          </div>
          <div
            className="flex-1 min-h-0 space-y-3 overflow-y-auto"
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
          >
            {CHARACTER_TRAIT_CATEGORIES.map(
              ({
                key,
                label,
                titleClass,
                chipClass,
                emptyClass,
                selectedClass,
              }) => (
                <TraitSection
                  key={key}
                  nodeId={item.nodeId}
                  category={key}
                  label={label}
                  titleClass={titleClass}
                  chipClass={chipClass}
                  emptyClass={emptyClass}
                  selectedClass={selectedClass}
                  traits={traits[key] ?? []}
                  onUpdateNodeData={updateCharacterNode}
                />
              ),
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
