"use client";

import {
  useCallback,
  useMemo,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";
import { Position, type NodeProps, useReactFlow } from "@xyflow/react";
import { Plus, X } from "lucide-react";
import { CustomHandle } from "./CustomHandle";
import type { CharacterNodeType, CharacterTraits } from "./workflow.constants";

type TraitCategory = keyof CharacterTraits;

const TRAIT_CATEGORIES: Array<{
  key: TraitCategory;
  label: string;
  accent: string;
}> = [
  { key: "physiology", label: "Physiology", accent: "border-rose-300" },
  { key: "psychology", label: "Psychology", accent: "border-violet-300" },
  { key: "sociology", label: "Sociology", accent: "border-sky-300" },
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
    <div className="flex w-56 flex-col rounded-lg border border-emerald-400 bg-white p-3 text-xs shadow-sm">
      <label className="text-[10px] font-semibold uppercase tracking-wide text-emerald-500">
        Character Name
        <input
          value={data?.name ?? ""}
          onChange={handleNameChange}
          placeholder="Name this character..."
          className="mt-1 w-full rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs text-slate-800 outline-none focus:border-emerald-400 focus:bg-white focus:ring-1 focus:ring-emerald-300"
        />
      </label>

      <div className="mt-3 space-y-2 overflow-y-auto pr-1">
        {TRAIT_CATEGORIES.map(({ key, label, accent }) => (
          <section
            key={key}
            className={`rounded border bg-emerald-50/40 p-2 ${accent}`}
          >
            <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wide text-emerald-600">
              <span>{label}</span>
            </div>
            <ul className="mt-1 space-y-1">
              {(traits[key] ?? []).map((trait, index) => (
                <li
                  key={`${key}-${trait}-${index}`}
                  className="flex items-center justify-between rounded bg-white px-2 py-1 text-[11px] text-slate-700 shadow-sm"
                >
                  <span className="mr-2 flex-1 leading-snug">{trait}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveTrait(key, index)}
                    className="flex h-5 w-5 items-center justify-center rounded-full border border-red-200 text-red-500 transition hover:bg-red-500 hover:text-white"
                    aria-label={`Remove ${label} trait`}
                  >
                    <X className="h-3 w-3" strokeWidth={2} />
                  </button>
                </li>
              ))}
              {(traits[key] ?? []).length === 0 && (
                <li className="rounded border border-dashed border-emerald-200 bg-white/70 px-2 py-2 text-[10px] text-emerald-500">
                  No {label.toLowerCase()} traits yet.
                </li>
              )}
            </ul>
            <div className="mt-2 flex items-center gap-2">
              <input
                value={draftTraits[key]}
                onChange={(event) => handleDraftChange(key, event)}
                onKeyDown={(event) => onTraitInputKeyDown(key, event)}
                placeholder={`Add ${label.toLowerCase()} trait`}
                className="flex-1 rounded border border-emerald-200 bg-white px-2 py-1 text-[11px] text-slate-700 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-300"
              />
              <button
                type="button"
                onClick={() => handleAddTrait(key)}
                className="flex h-6 w-6 items-center justify-center rounded-full border border-emerald-300 bg-emerald-100 text-emerald-700 transition hover:bg-emerald-500 hover:text-white"
                aria-label={`Add ${label} trait`}
              >
                <Plus className="h-3 w-3" strokeWidth={2} />
              </button>
            </div>
          </section>
        ))}
      </div>

      <CustomHandle type="target" position={Position.Top} id="narration" />
    </div>
  );
}
