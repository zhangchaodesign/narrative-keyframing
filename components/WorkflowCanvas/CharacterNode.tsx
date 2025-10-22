"use client";

import {
  useCallback,
  useMemo,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";
import { Position, type NodeProps, useReactFlow } from "@xyflow/react";
import { TbCheck, TbPlus, TbX } from "react-icons/tb";
import { CustomHandle } from "./CustomHandle";
import type { CharacterNodeType, CharacterTraits } from "./workflow.constants";

type TraitCategory = keyof CharacterTraits;

const TRAIT_CATEGORIES: Array<{
  key: TraitCategory;
  label: string;
  titleClass: string;
  chipClass: string;
  emptyClass: string;
}> = [
  {
    key: "physiology",
    label: "Physiology",
    titleClass: "text-blue-700",
    chipClass:
      "border-blue-200 bg-blue-50 text-blue-900 hover:bg-blue-100 focus-visible:ring focus-visible:ring-blue-200",
    emptyClass: "border-blue-200 text-blue-700",
  },
  {
    key: "psychology",
    label: "Psychology",
    titleClass: "text-purple-700",
    chipClass:
      "border-purple-200 bg-purple-50 text-purple-900 hover:bg-purple-100 focus-visible:ring focus-visible:ring-purple-200",
    emptyClass: "border-purple-200 text-purple-700",
  },
  {
    key: "sociology",
    label: "Sociology",
    titleClass: "text-green-700",
    chipClass:
      "border-green-200 bg-green-50 text-green-900 hover:bg-green-100 focus-visible:ring focus-visible:ring-green-200",
    emptyClass: "border-green-200 text-green-700",
  },
];

export function CharacterNode({ id, data }: NodeProps<CharacterNodeType>) {
  const { setNodes } = useReactFlow();

  const [draftTraits, setDraftTraits] = useState<Record<TraitCategory, string>>(
    () => ({
      physiology: "",
      psychology: "",
      sociology: "",
    }),
  );
  const [activeCategory, setActiveCategory] = useState<TraitCategory | null>(
    null,
  );

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

  const updateNodeData = useCallback(
    (
      updater: (
        current: CharacterTraits,
        name: string,
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
            data: updater(currentTraits, currentData?.name ?? ""),
          };
        }),
      );
    },
    [id, setNodes],
  );

  const handleNameChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const nextName = event.target.value;
      updateNodeData((currentTraits) => ({
        name: nextName,
        traits: currentTraits,
      }));
    },
    [updateNodeData],
  );

  const handleDraftChange = useCallback(
    (category: TraitCategory, event: ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      setDraftTraits((prev) => ({ ...prev, [category]: value }));
    },
    [],
  );

  const handleAddTrait = useCallback(
    (category: TraitCategory) => {
      const draftValue = draftTraits[category]?.trim();
      if (!draftValue) return;

      updateNodeData((currentTraits, currentName) => ({
        name: currentName,
        traits: {
          ...currentTraits,
          [category]: [...(currentTraits[category] ?? []), draftValue],
        },
      }));

      setDraftTraits((prev) => ({ ...prev, [category]: "" }));
    },
    [draftTraits, updateNodeData],
  );

  const toggleAddInput = useCallback((category: TraitCategory) => {
    setActiveCategory((current) => (current === category ? null : category));
  }, []);

  const handleRemoveTrait = useCallback(
    (category: TraitCategory, index: number) => {
      updateNodeData((currentTraits, currentName) => ({
        name: currentName,
        traits: {
          ...currentTraits,
          [category]: currentTraits[category]?.filter(
            (_trait, traitIndex) => traitIndex !== index,
          ),
        },
      }));
    },
    [updateNodeData],
  );

  const onTraitInputKeyDown = useCallback(
    (category: TraitCategory, event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter") {
        event.preventDefault();
        handleAddTrait(category);
      }
    },
    [handleAddTrait],
  );

  return (
    <div className="flex w-56 flex-col gap-3 rounded-lg border border-yellow-300 p-3 text-xs bg-yellow-50">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-800">
          🧙 Character
        </span>
      </div>
      <label>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-800">
          Name
        </p>
        <input
          value={data?.name ?? ""}
          onChange={handleNameChange}
          placeholder="Name this character..."
          className="mt-2 w-full resize-none rounded border border-zinc-300 bg-white/70 px-2 py-1 text-[10px] leading-snug text-zinc-700 outline-none focus:border-zinc-500 focus:bg-white focus:ring-1 focus:ring-zinc-400"
        />
      </label>

      <div className="space-y-3">
        {TRAIT_CATEGORIES.map(
          ({ key, label, titleClass, chipClass, emptyClass }) => (
            <section key={key} className="">
              <div className="flex items-center justify-between gap-2">
                <h4
                  className={`text-[10px] font-semibold uppercase tracking-wide ${titleClass}`}
                >
                  {label}
                </h4>
                <button
                  type="button"
                  onClick={() => toggleAddInput(key)}
                  className={`flex cursor-pointer items-center justify-center rounded-full bg-white transition ${
                    activeCategory === key ? "text-red-500" : "text-yellow-700"
                  }`}
                  aria-label={
                    activeCategory === key
                      ? `Hide ${label} trait input`
                      : `Add ${label} trait`
                  }
                >
                  {activeCategory === key ? (
                    <TbX className="h-3 w-3" />
                  ) : (
                    <TbPlus className="h-3 w-3" />
                  )}
                </button>
              </div>
              <div className="mt-2 flex flex-wrap items-start gap-1">
                {(traits[key] ?? []).map((trait, index) => (
                  <div
                    key={`${key}-${trait}-${index}`}
                    className={`group inline-flex relative items-center gap-1 rounded border px-2 py-1 text-[10px] transition ${chipClass}`}
                  >
                    <span className="leading-snug">{trait}</span>
                    <div className="absolute right-1 top-1/2 z-10 hidden -translate-y-1/2 items-center gap-0.5 group-hover:flex">
                      <button
                        type="button"
                        onClick={() => handleRemoveTrait(key, index)}
                        className="pointer-events-auto rounded bg-white/80 p-0.5 text-red-500 shadow-sm hover:bg-white hover:text-red-700  cursor-pointer"
                        aria-label={`Remove ${label} trait`}
                      >
                        <TbX className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
                {(traits[key] ?? []).length === 0 && (
                  <span
                    className={`rounded border border-dashed bg-white/70 px-2 py-1 text-[10px] ${emptyClass}`}
                  >
                    No {label.toLowerCase()} traits yet.
                  </span>
                )}
              </div>
              {activeCategory === key && (
                <div className="mt-2 flex items-center gap-2">
                  <input
                    value={draftTraits[key]}
                    onChange={(event) => handleDraftChange(key, event)}
                    onKeyDown={(event) => onTraitInputKeyDown(key, event)}
                    placeholder={`Add ${label.toLowerCase()} trait`}
                    className="flex-1 rounded border border-zinc-300 bg-zinc-50 px-2 py-1 text-[10px] leading-snug text-zinc-700 outline-none focus:border-zinc-500 focus:bg-white focus:ring-1 focus:ring-zinc-400"
                  />
                  <button
                    type="button"
                    onClick={() => handleAddTrait(key)}
                    className="flex cursor-pointer items-center justify-center rounded-full bg-white text-green-700"
                    aria-label={`Confirm ${label} trait`}
                  >
                    <TbCheck size={12} />
                  </button>
                </div>
              )}
            </section>
          ),
        )}
      </div>

      <CustomHandle type="target" position={Position.Top} id="narration" />
    </div>
  );
}
