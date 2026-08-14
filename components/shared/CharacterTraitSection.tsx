"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FocusEvent,
  type KeyboardEvent,
} from "react";
import { TbPlus, TbSparkles } from "react-icons/tb";
import type { CharacterTraits } from "@/lib/types/workflow";
import { TraitItem } from "@/components/shared/CharacterTraitItem";
import { useWorkflowStore } from "@/lib/stores/workflowStore";
import {
  brainstormCharacterTraits,
  type CharacterBrainstormContext,
} from "@/lib/utiils/characterUtils";

type TraitCategory = keyof CharacterTraits;

interface TraitSectionProps {
  nodeId: string;
  category: TraitCategory;
  label: string;
  sizeVariant?: "default" | "character-node";
  titleClass: string;
  chipClass: string;
  emptyClass: string;
  selectedClass: string;
  traits: string[];
  brainstormContext?: CharacterBrainstormContext | null;
  onUpdateNodeData: (
    updater: (
      currentTraits: CharacterTraits,
      currentName: string,
      currentPerspectiveId: string,
    ) => { name: string; traits: CharacterTraits; perspectiveId: string },
  ) => void;
}

export function TraitSection({
  nodeId,
  category,
  label,
  sizeVariant = "default",
  titleClass,
  chipClass,
  emptyClass,
  selectedClass,
  traits,
  brainstormContext,
  onUpdateNodeData,
}: TraitSectionProps) {
  const isCharacterNodeVariant = sizeVariant === "character-node";
  const addInputRef = useRef<HTMLInputElement | null>(null);
  const [draftValue, setDraftValue] = useState("");
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [isBrainstorming, setIsBrainstorming] = useState(false);

  const workflowNodes = useWorkflowStore((state) => state.nodes);
  const clearEvidenceAttribute = useWorkflowStore(
    (state) => state.clearEvidenceAttribute,
  );

  const characterName = useMemo(() => {
    const characterNode = workflowNodes.find(
      (node) => node.id === nodeId && node.type === "character",
    );
    return (characterNode?.data as { name?: string } | undefined)?.name ?? "";
  }, [workflowNodes, nodeId]);

  const canBrainstorm = useMemo(
    () =>
      Boolean(
        brainstormContext?.baselineStoryText?.length &&
        brainstormContext?.baselineActText?.length,
      ),
    [brainstormContext],
  );

  const brainstormTooltip = canBrainstorm
    ? `Brainstorm ${label.toLowerCase()} traits`
    : "";

  const handleDraftChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setDraftValue(event.target.value);
    },
    [],
  );

  const handleAddTrait = useCallback(() => {
    const trimmed = draftValue.trim();
    if (!trimmed) return;

    onUpdateNodeData((currentTraits, currentName, currentPerspectiveId) => ({
      name: currentName,
      traits: {
        ...currentTraits,
        [category]: [...(currentTraits[category] ?? []), trimmed],
      },
      perspectiveId: currentPerspectiveId,
    }));

    setDraftValue("");
  }, [draftValue, onUpdateNodeData, category, characterName, nodeId]);

  const toggleAddInput = useCallback(() => {
    setIsAddingNew((current) => !current);
  }, []);

  const handleRemoveTrait = useCallback(
    (index: number) => {
      const traitValue = traits[index];
      if (traitValue) {
        clearEvidenceAttribute(nodeId, traitValue);
      }

      onUpdateNodeData((currentTraits, currentName, currentPerspectiveId) => ({
        name: currentName,
        traits: {
          ...currentTraits,
          [category]: currentTraits[category]?.filter(
            (_trait, traitIndex) => traitIndex !== index,
          ),
        },
        perspectiveId: currentPerspectiveId,
      }));
    },
    [
      clearEvidenceAttribute,
      nodeId,
      characterName,
      traits,
      onUpdateNodeData,
      category,
    ],
  );

  const handleUpdateTrait = useCallback(
    (index: number, nextValue: string) => {
      const trimmed = nextValue.trim();
      if (!trimmed) {
        return;
      }

      onUpdateNodeData((currentTraits, currentName, currentPerspectiveId) => {
        const categoryTraits = [...(currentTraits[category] ?? [])];
        if (index < 0 || index >= categoryTraits.length) {
          return {
            name: currentName,
            traits: currentTraits,
            perspectiveId: currentPerspectiveId,
          };
        }

        const previousValue = categoryTraits[index];

        if (previousValue) {
          clearEvidenceAttribute(nodeId, previousValue);
        }

        categoryTraits[index] = trimmed;

        return {
          name: currentName,
          traits: {
            ...currentTraits,
            [category]: categoryTraits,
          },
          perspectiveId: currentPerspectiveId,
        };
      });
    },
    [clearEvidenceAttribute, nodeId, characterName, onUpdateNodeData, category],
  );

  const handleBrainstormTraits = useCallback(async () => {
    if (!canBrainstorm || isBrainstorming || !brainstormContext) {
      return;
    }

    const normalizeTrait = (value: string) => value.trim().toLowerCase();

    setIsBrainstorming(true);
    try {
      const suggestions = await brainstormCharacterTraits({
        category,
        context: brainstormContext,
        existingTraits: traits,
      });

      if (suggestions.length === 0) {
        return;
      }

      const existing = traits ?? [];
      const normalized = new Set(existing.map(normalizeTrait));
      const newSuggestions: string[] = [];

      suggestions.forEach((suggestion) => {
        const cleaned = suggestion.trim();
        if (!cleaned) {
          return;
        }
        const key = normalizeTrait(cleaned);
        if (!normalized.has(key)) {
          newSuggestions.push(cleaned);
        }
      });

      onUpdateNodeData((currentTraits, currentName, currentPerspectiveId) => {
        const existing = currentTraits[category] ?? [];
        const normalized = new Set(existing.map(normalizeTrait));
        const nextTraits = [...existing];

        suggestions.forEach((suggestion) => {
          const cleaned = suggestion.trim();
          if (!cleaned) {
            return;
          }
          const key = normalizeTrait(cleaned);
          if (normalized.has(key)) {
            return;
          }
          normalized.add(key);
          nextTraits.push(cleaned);
        });

        return {
          name: currentName,
          traits: {
            ...currentTraits,
            [category]: nextTraits,
          },
          perspectiveId: currentPerspectiveId,
        };
      });
    } catch (error) {
      console.error("Error brainstorming traits:", error);
    } finally {
      setIsBrainstorming(false);
    }
  }, [
    brainstormContext,
    canBrainstorm,
    category,
    characterName,
    isBrainstorming,
    nodeId,
    onUpdateNodeData,
    traits,
  ]);

  useEffect(() => {
    if (isAddingNew) {
      addInputRef.current?.focus();
    }
  }, [isAddingNew]);

  const handleAddInputFocus = useCallback(
    (_event: FocusEvent<HTMLInputElement>) => {},
    [nodeId, characterName, category],
  );

  const handleAddInputBlur = useCallback(
    (event: FocusEvent<HTMLInputElement>) => {
      const trimmed = event.target.value.trim();
      if (trimmed) {
        handleAddTrait();
      }
    },
    [nodeId, characterName, category, handleAddTrait],
  );

  const onTraitInputKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter") {
        event.preventDefault();
        handleAddTrait();
      }
    },
    [handleAddTrait],
  );

  return (
    <section className="">
      <div className="flex items-center justify-between gap-2">
        <h4
          className={`font-semibold uppercase tracking-wide ${
            isCharacterNodeVariant ? "text-[11px]" : "text-xs"
          } ${titleClass}`}
        >
          {label}
        </h4>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleBrainstormTraits}
            className={`flex items-center justify-center rounded-full bg-white transition ${
              isBrainstorming
                ? "text-amber-500"
                : "text-gray-500 hover:text-gray-700"
            }`}
            aria-label={brainstormTooltip}
            title={brainstormTooltip}
            disabled={!canBrainstorm || isBrainstorming}
          >
            {isBrainstorming ? (
              <span className="loading loading-spinner h-3 w-3 text-amber-500" />
            ) : (
              <TbSparkles size={12} />
            )}
          </button>
          <button
            type="button"
            onClick={toggleAddInput}
            className="flex cursor-pointer items-center justify-center rounded-full bg-white text-gray-500 hover:text-gray-700 transition"
            aria-label={`Add ${label} trait`}
          >
            <TbPlus size={12} />
          </button>
        </div>
      </div>
      <div className="mt-2 flex flex-col gap-2">
        {traits.map((trait, index) => (
          <TraitItem
            key={`${nodeId}-${category}-${trait}-${index}`}
            category={category}
            nodeId={nodeId}
            trait={trait}
            index={index}
            label={label}
            sizeVariant={sizeVariant}
            chipClass={chipClass}
            selectedClass={selectedClass}
            onEdit={handleUpdateTrait}
            onRemove={handleRemoveTrait}
          />
        ))}
        {traits.length === 0 && !isAddingNew && (
          <span
            className={`rounded border border-dashed bg-white/70 px-2 py-1 text-xs ${emptyClass}`}
          >
            No {label.toLowerCase()} traits yet.
          </span>
        )}
      </div>
      {isAddingNew && (
        <div className="mt-2">
          <input
            ref={addInputRef}
            value={draftValue}
            onChange={handleDraftChange}
            onKeyDown={onTraitInputKeyDown}
            onFocus={handleAddInputFocus}
            onBlur={handleAddInputBlur}
            placeholder={`Add ${label.toLowerCase()} trait`}
            className="w-full rounded border border-gray-300 px-2 py-1 text-xs leading-snug text-gray-800 outline-none focus:border-gray-500 focus:bg-white focus:ring-gray-400"
          />
        </div>
      )}
    </section>
  );
}
