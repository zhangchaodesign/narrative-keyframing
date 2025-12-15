"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { Position, type NodeProps, useReactFlow } from "@xyflow/react";
import { CustomHandle } from "@/components/WorkflowCanvas/CustomHandle";
import { CharacterMenu } from "@/components/WorkflowCanvas/CharacterNode/CharacterMenu";
import { TraitSection } from "@/components/WorkflowCanvas/CharacterNode/TraitSection";
import type { CharacterNodeType, CharacterTraits } from "@/lib/types/workflow";
import { cn } from "@/lib/utiils/sharedUtils";
import { geistMono } from "@/app/fonts";

type TraitCategory = keyof CharacterTraits;

const TRAIT_CATEGORIES: Array<{
  key: TraitCategory;
  label: string;
  titleClass: string;
  chipClass: string;
  emptyClass: string;
  selectedClass: string;
}> = [
  {
    key: "physiology",
    label: "Physiology",
    titleClass: "text-blue-700",
    chipClass:
      "border-blue-200 bg-blue-50 text-blue-900 hover:bg-blue-500 hover:text-white focus-visible:ring focus-visible:ring-blue-200",
    emptyClass: "border-blue-200 text-blue-700",
    selectedClass: "border-transparent bg-blue-500 text-white",
  },
  {
    key: "psychology",
    label: "Psychology",
    titleClass: "text-purple-700",
    chipClass:
      "border-purple-200 bg-purple-50 text-purple-900 hover:bg-purple-500 hover:text-white focus-visible:ring focus-visible:ring-purple-200",
    emptyClass: "border-purple-200 text-purple-700",
    selectedClass: "border-transparent bg-purple-500 text-white",
  },
  {
    key: "sociology",
    label: "Sociology",
    titleClass: "text-green-700",
    chipClass:
      "border-green-200 bg-green-50 text-green-900 hover:bg-green-500 hover:text-white focus-visible:ring focus-visible:ring-green-200",
    emptyClass: "border-green-200 text-green-700",
    selectedClass: "border-transparent bg-green-500 text-white",
  },
];

export function CharacterNode({ id, data }: NodeProps<CharacterNodeType>) {
  const { setNodes } = useReactFlow();

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isRefreshingSnapshot, setIsRefreshingSnapshot] = useState(false);

  const traits = useMemo<CharacterTraits>(() => {
    if (!data?.traits) {
      return {
        physiology: [],
        psychology: [],
        sociology: [],
      };
    }
    return {
      physiology: data.traits.physiology ?? [],
      psychology: data.traits.psychology ?? [],
      sociology: data.traits.sociology ?? [],
    };
  }, [data?.traits]);
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
          const currentTraits: CharacterTraits = {
            physiology: [...(currentData?.traits?.physiology ?? [])],
            psychology: [...(currentData?.traits?.psychology ?? [])],
            sociology: [...(currentData?.traits?.sociology ?? [])],
          };

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
        {isRefreshingSnapshot && (
          <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center rounded-lg bg-white/80 backdrop-blur-sm">
            <span className="loading loading-spinner text-warning" />
            <span className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-warning">
              Updating snapshot...
            </span>
          </div>
        )}
        <CharacterMenu
          nodeId={id}
          nodeType="character"
          isRefreshing={isRefreshingSnapshot}
          onRefreshStateChange={setIsRefreshingSnapshot}
        />
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
            {TRAIT_CATEGORIES.map(
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
