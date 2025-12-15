"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
} from "react";
import { cn } from "@/lib/utils";
import { geistMono } from "@/app/fonts";
import type { TimelineItem } from "@/lib/types/timeline";
import { TIMELINE_LABEL_WIDTH } from "@/components/TimelineView/constants";
import { useWorkflowStore } from "@/lib/stores/workflowStore";
import type { CharacterNodeData } from "@/lib/types/workflow";

type TraitCategory = keyof CharacterNodeData["traits"];

interface CharacterBlockProps {
  item: TimelineItem;
  timeToPixel: (position: number) => number;
  timelineScale: number;
}

const formatTraitInput = (values?: string[]) =>
  values && values.length > 0 ? values.join(", ") : "";

const parseTraitValue = (value: string): string[] =>
  value
    .split(/[\n,]+/)
    .map((token) => token.trim())
    .filter(Boolean);

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

  const [nameValue, setNameValue] = useState(characterData?.name ?? "");
  const [physiologyInput, setPhysiologyInput] = useState(
    formatTraitInput(characterData?.traits?.physiology),
  );
  const [psychologyInput, setPsychologyInput] = useState(
    formatTraitInput(characterData?.traits?.psychology),
  );
  const [sociologyInput, setSociologyInput] = useState(
    formatTraitInput(characterData?.traits?.sociology),
  );

  useEffect(() => {
    setNameValue(characterData?.name ?? "");
  }, [characterData?.name]);

  useEffect(() => {
    setPhysiologyInput(formatTraitInput(characterData?.traits?.physiology));
  }, [characterData?.traits?.physiology]);

  useEffect(() => {
    setPsychologyInput(formatTraitInput(characterData?.traits?.psychology));
  }, [characterData?.traits?.psychology]);

  useEffect(() => {
    setSociologyInput(formatTraitInput(characterData?.traits?.sociology));
  }, [characterData?.traits?.sociology]);

  const safeWidth = Math.max(timelineScale - 8, 24);
  const itemWidth = Math.min(safeWidth, timelineScale);
  const leftPosition = timeToPixel(item.position) - TIMELINE_LABEL_WIDTH;

  const updateCharacterNode = useCallback(
    (
      updater: (
        current: CharacterNodeData | undefined,
      ) => CharacterNodeData | undefined,
    ) => {
      setNodes((nodes) =>
        nodes.map((node) => {
          if (node.id !== item.nodeId || node.type !== "character") {
            return node;
          }

          const currentData = node.data as CharacterNodeData | undefined;
          const nextData = updater(currentData);
          if (!nextData) {
            return node;
          }

          return {
            ...node,
            data: nextData,
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
      updateCharacterNode((currentData) => {
        const baseTraits = currentData?.traits ?? {
          physiology: [],
          psychology: [],
          sociology: [],
        };
        return {
          ...(currentData ?? {
            name: "",
            traits: baseTraits,
            perspectiveId: "",
          }),
          name: nextValue,
          traits: baseTraits,
        };
      });
    },
    [updateCharacterNode],
  );

  const handleTraitChange = useCallback(
    (category: TraitCategory, setter: (value: string) => void) =>
      (event: ChangeEvent<HTMLTextAreaElement>) => {
        const nextValue = event.target.value;
        setter(nextValue);
        const parsedValues = parseTraitValue(nextValue);
        updateCharacterNode((currentData) => {
          const baseTraits = {
            physiology: [...(currentData?.traits?.physiology ?? [])],
            psychology: [...(currentData?.traits?.psychology ?? [])],
            sociology: [...(currentData?.traits?.sociology ?? [])],
          };
          baseTraits[category] = parsedValues;

          return {
            ...(currentData ?? {
              name: "",
              perspectiveId: "",
              traits: baseTraits,
            }),
            traits: baseTraits,
          };
        });
      },
    [updateCharacterNode],
  );

  const traitInputs = [
    {
      key: "physiology" as TraitCategory,
      label: "Physiology",
      value: physiologyInput,
      setValue: setPhysiologyInput,
      chipClass: "border-blue-200 bg-blue-50 text-blue-900",
    },
    {
      key: "psychology" as TraitCategory,
      label: "Psychology",
      value: psychologyInput,
      setValue: setPsychologyInput,
      chipClass: "border-purple-200 bg-purple-50 text-purple-900",
    },
    {
      key: "sociology" as TraitCategory,
      label: "Sociology",
      value: sociologyInput,
      setValue: setSociologyInput,
      chipClass: "border-green-200 bg-green-50 text-green-900",
    },
  ];

  return (
    <div
      className="absolute top-1 bottom-1"
      style={{
        left: `${leftPosition}px`,
        width: `${itemWidth}px`,
      }}
    >
      <div className="group relative flex h-full flex-col rounded-lg border-2 border-warning bg-white/95 px-3 py-2 text-xs text-zinc-800 transition-shadow hover:shadow-lg">
        <div
          className={cn(
            geistMono.className,
            "flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-800",
          )}
        >
          <span aria-hidden="true">🧙</span>
          <span>Character Snapshot</span>
        </div>
        <input
          value={nameValue}
          onChange={handleNameChange}
          placeholder="Character name"
          className="mt-2 w-full rounded border border-zinc-300 bg-white/80 px-2 py-1 text-[12px] font-semibold text-zinc-900 outline-none focus:border-zinc-500 focus:bg-white focus:ring-1 focus:ring-zinc-400 nodrag nopan"
          onPointerDown={(event) => event.stopPropagation()}
        />
        <div className="mt-2 flex flex-1 flex-col gap-2 overflow-hidden">
          {traitInputs.map(({ key, label, value, setValue, chipClass }) => (
            <div key={key} className="flex flex-col gap-1">
              <span
                className={cn(
                  geistMono.className,
                  "text-[10px] font-semibold uppercase tracking-wide text-zinc-700",
                )}
              >
                {label}
              </span>
              <textarea
                value={value}
                onChange={handleTraitChange(key, setValue)}
                placeholder={`Enter ${label.toLowerCase()} traits...`}
                rows={2}
                onPointerDown={(event) => event.stopPropagation()}
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
                className={cn(
                  "w-full flex-1 resize-none rounded border px-2 py-1 text-[11px] leading-snug text-zinc-800 outline-none focus:ring-1 nodrag nopan",
                  chipClass,
                  "bg-white/80 focus:bg-white focus:border-zinc-500 focus:ring-zinc-400",
                )}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
