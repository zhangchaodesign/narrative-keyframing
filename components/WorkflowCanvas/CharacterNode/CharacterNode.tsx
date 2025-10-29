"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";
import { Position, type NodeProps, useReactFlow } from "@xyflow/react";
import { TbCheck, TbPencil, TbPlus, TbX } from "react-icons/tb";
import { CustomHandle } from "@/components/WorkflowCanvas/CustomHandle";
import { CharacterMenu } from "@/components/WorkflowCanvas/CharacterNode/CharacterMenu";
import type { CharacterNodeType, CharacterTraits } from "@/lib/types/workflow";
import { cn } from "@/lib/utils/utils";
import { geistMono } from "@/app/fonts";

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

  const containerRef = useRef<HTMLDivElement | null>(null);
  const editingInputRef = useRef<HTMLInputElement | null>(null);

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
  const [editingTrait, setEditingTrait] = useState<{
    category: TraitCategory;
    index: number;
    value: string;
  } | null>(null);

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
    setEditingTrait(null);
    setActiveCategory((current) => (current === category ? null : category));
  }, []);

  const handleRemoveTrait = useCallback(
    (category: TraitCategory, index: number) => {
      setEditingTrait((current) =>
        current && current.category === category ? null : current,
      );
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

  const handleUpdateTrait = useCallback(
    (category: TraitCategory, index: number, nextValue: string) => {
      const trimmed = nextValue.trim();
      if (!trimmed) {
        return;
      }

      updateNodeData((currentTraits, currentName) => {
        const categoryTraits = [...(currentTraits[category] ?? [])];
        if (index < 0 || index >= categoryTraits.length) {
          return {
            name: currentName,
            traits: currentTraits,
          };
        }

        categoryTraits[index] = trimmed;

        return {
          name: currentName,
          traits: {
            ...currentTraits,
            [category]: categoryTraits,
          },
        };
      });
    },
    [updateNodeData],
  );

  const handleStartEdit = useCallback(
    (category: TraitCategory, index: number, value: string) => {
      setActiveCategory(null);
      setEditingTrait({ category, index, value });
    },
    [],
  );

  const handleEditChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const { value } = event.target;
      setEditingTrait((prev) => (prev ? { ...prev, value } : prev));
    },
    [],
  );

  const handleEditCancel = useCallback(() => {
    setEditingTrait(null);
  }, []);

  const handleEditConfirm = useCallback(() => {
    if (!editingTrait) {
      return;
    }

    const trimmed = editingTrait.value.trim();
    if (!trimmed) {
      return;
    }

    handleUpdateTrait(editingTrait.category, editingTrait.index, trimmed);
    setEditingTrait(null);
  }, [editingTrait, handleUpdateTrait]);

  const onEditInputKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter") {
        event.preventDefault();
        handleEditConfirm();
      } else if (event.key === "Escape") {
        event.preventDefault();
        handleEditCancel();
      }
    },
    [handleEditCancel, handleEditConfirm],
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

  useEffect(() => {
    if (editingTrait) {
      editingInputRef.current?.focus();
      editingInputRef.current?.select();
    }
  }, [editingTrait]);

  return (
    <div className="group relative w-64">
      <div
        ref={containerRef}
        className="flex max-h-80 flex-col rounded-lg border-2 border-warning bg-white text-xs hover:shadow-lg"
      >
        <CharacterMenu nodeId={id} nodeType="character" />
        <div
          className="flex flex-1 flex-col gap-3 overflow-y-auto p-3 min-h-0"
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
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-800">
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
                        activeCategory === key
                          ? "text-red-500 hover:text-red-700"
                          : "text-zinc-500 hover:text-zinc-700"
                      }`}
                      aria-label={
                        activeCategory === key
                          ? `Hide ${label} trait input`
                          : `Add ${label} trait`
                      }
                    >
                      {activeCategory === key ? (
                        <TbX size={12} />
                      ) : (
                        <TbPlus size={12} />
                      )}
                    </button>
                  </div>
                  <div className="mt-2 flex flex-col gap-2">
                    {(traits[key] ?? []).map((trait, index) => {
                      const isEditing =
                        editingTrait?.category === key &&
                        editingTrait.index === index;

                      return (
                        <div
                          key={`${key}-${trait}-${index}`}
                          className={`group/trait relative flex items-center rounded border-none text-[10px] transition ${chipClass}`}
                        >
                          {isEditing ? (
                            <input
                              ref={editingInputRef}
                              value={editingTrait.value}
                              onChange={handleEditChange}
                              onKeyDown={onEditInputKeyDown}
                              className="flex-1 rounded border border-zinc-300 bg-white/80 px-2 py-1 text-[10px] leading-snug text-zinc-800 outline-none focus:border-zinc-500 focus:bg-white focus:ring-1 focus:ring-zinc-400"
                              aria-label={`Edit ${label} trait`}
                            />
                          ) : (
                            <span className="flex-1 leading-snug pr-10 px-2 py-1 font-medium">
                              {trait}
                            </span>
                          )}
                          <div
                            className={`absolute right-1 top-1/2 z-10 -translate-y-1/2 items-center ${
                              isEditing
                                ? "flex"
                                : "hidden group-hover/trait:flex group-focus-within/trait:flex"
                            }`}
                          >
                            {isEditing ? (
                              <>
                                <button
                                  onClick={handleEditConfirm}
                                  className="pointer-events-auto rounded p-0.5 text-green-500 hover:text-green-700 cursor-pointer"
                                  title="Save attribute"
                                  aria-label={`Save ${label} trait`}
                                >
                                  <TbCheck size={12} />
                                </button>
                                <button
                                  onClick={handleEditCancel}
                                  className="pointer-events-auto rounded p-0.5 text-red-500 hover:text-red-700 cursor-pointer"
                                  title="Cancel editing"
                                  aria-label={`Cancel editing ${label} trait`}
                                >
                                  <TbX size={12} />
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() =>
                                    handleStartEdit(key, index, trait)
                                  }
                                  className="pointer-events-auto rounded p-0.5 text-zinc-600 hover:text-zinc-800 cursor-pointer"
                                  title="Edit attribute"
                                  aria-label={`Edit ${label} trait`}
                                >
                                  <TbPencil size={12} />
                                </button>
                                <button
                                  onClick={() => handleRemoveTrait(key, index)}
                                  className="pointer-events-auto rounded p-0.5 text-red-500 hover:text-red-700 cursor-pointer"
                                  title="Remove attribute"
                                  aria-label={`Remove ${label} trait`}
                                >
                                  <TbX size={12} />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
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
                        className="flex-1 rounded border border-zinc-300 bg-zinc-50 px-2 py-1 text-[10px] leading-snug text-zinc-800 outline-none focus:border-zinc-500 focus:bg-white focus:ring-1 focus:ring-zinc-400"
                      />
                      <button
                        type="button"
                        onClick={() => handleAddTrait(key)}
                        className="flex cursor-pointer items-center justify-center rounded-full bg-white text-green-500 hover:text-green-700"
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
