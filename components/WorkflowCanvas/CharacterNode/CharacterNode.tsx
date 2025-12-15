"use client";

import { useCallback, useMemo, useRef } from "react";
import { Position, type NodeProps, useReactFlow } from "@xyflow/react";
import { CustomHandle } from "@/components/WorkflowCanvas/CustomHandle";
import { CharacterMenu } from "@/components/WorkflowCanvas/CharacterNode/CharacterMenu";
import { TraitSection } from "@/components/shared/CharacterTraitSection";
import type { CharacterNodeType, CharacterTraits } from "@/lib/types/workflow";
import { cn } from "@/lib/utiils/sharedUtils";
import { geistMono } from "@/app/fonts";
import {
  CHARACTER_TRAIT_CATEGORIES,
  normalizeCharacterTraits,
} from "@/lib/utiils/characterUtils";

export function CharacterNode({ id, data }: NodeProps<CharacterNodeType>) {
  const { setNodes } = useReactFlow();

  const containerRef = useRef<HTMLDivElement | null>(null);

  const traits = useMemo<CharacterTraits>(
    () => normalizeCharacterTraits(data?.traits),
    [data?.traits],
  );
  const characterName = data?.name?.trim() ?? "";

  const updateNodeData = useCallback(
    (
      updater: (
        current: CharacterTraits,
        name: string,
        perspectiveId: string,
      ) => CharacterNodeType["data"],
    ) => {
      setNodes((nodes) =>
        nodes.map((node) => {
          if (node.id !== id || node.type !== "character") {
            return node;
          }

          const currentData = node.data as CharacterNodeType["data"];
          const currentTraits = normalizeCharacterTraits(currentData?.traits);

          return {
            ...node,
            data: updater(
              currentTraits,
              currentData?.name ?? "",
              currentData?.perspectiveId ?? "",
            ),
          };
        }),
      );
    },
    [id, setNodes],
  );

  return (
    <div className="group relative w-64">
      <div
        ref={containerRef}
        className="relative flex max-h-88 flex-col rounded-lg border-2 border-warning bg-white text-xs hover:shadow-lg"
      >
        {data?.isRefreshing && (
          <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center rounded-lg bg-white/80 backdrop-blur-sm">
            <span className="loading loading-spinner text-warning" />
            <span className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-warning">
              Updating snapshot...
            </span>
          </div>
        )}
        <CharacterMenu nodeId={id} />
        <div className="flex flex-1 flex-col gap-3 p-3 min-h-0">
          <div className="flex items-center justify-between">
            <span
              className={cn(
                geistMono.className,
                "text-[10px] font-semibold uppercase tracking-wide text-zinc-800",
              )}
            >
              🧙 Character Snapshot
            </span>
          </div>
          <div>
            <p
              className={cn(
                geistMono.className,
                "text-base font-semibold tracking-wide text-zinc-800",
              )}
            >
              {characterName ? characterName : "Unknown"}
            </p>
            {/* <div className="mt-2 w-full rounded bg-zinc-50 px-2 py-1 text-[10px] leading-snug text-zinc-800">
              {characterName ? (
                characterName
              ) : (
                <span className="italic text-zinc-500">
                  Set in the perspective cluster
                </span>
              )}
            </div> */}
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
                  nodeId={id}
                  category={key}
                  label={label}
                  titleClass={titleClass}
                  chipClass={chipClass}
                  emptyClass={emptyClass}
                  selectedClass={selectedClass}
                  traits={traits[key] ?? []}
                  onUpdateNodeData={updateNodeData}
                />
              ),
            )}
          </div>
        </div>
        <CustomHandle
          type="source"
          position={Position.Top}
          id="perspective"
          style={{
            background: "lightgray",
          }}
        />
      </div>
    </div>
  );
}
