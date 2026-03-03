"use client";

import {
  useCallback,
  useMemo,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";
import { TbCheck, TbPlus, TbSparkles, TbX } from "react-icons/tb";
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
  titleClass,
  chipClass,
  emptyClass,
  selectedClass,
  traits,
  brainstormContext,
  onUpdateNodeData,
}: TraitSectionProps) {
  const [draftValue, setDraftValue] = useState("");
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [isBrainstorming, setIsBrainstorming] = useState(false);

  const clearEvidenceAttribute = useWorkflowStore(
    (state) => state.clearEvidenceAttribute,
  );

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
  }, [draftValue, onUpdateNodeData, category]);

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
    [clearEvidenceAttribute, nodeId, traits, onUpdateNodeData, category],
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
    [clearEvidenceAttribute, nodeId, onUpdateNodeData, category],
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
    isBrainstorming,
    onUpdateNodeData,
    traits,
  ]);

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
          className={`text-[10px] font-semibold uppercase tracking-wide ${titleClass}`}
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
            className={`flex cursor-pointer items-center justify-center rounded-full bg-white transition ${
              isAddingNew
                ? "text-red-500 hover:text-red-700"
                : "text-gray-500 hover:text-gray-700"
            }`}
            aria-label={
              isAddingNew ? `Hide ${label} trait input` : `Add ${label} trait`
            }
          >
            {isAddingNew ? <TbX size={12} /> : <TbPlus size={12} />}
          </button>
        </div>
      </div>
      <div className="mt-2 flex flex-col gap-2">
        {traits.map((trait, index) => (
          <TraitItem
            key={`${category}-${trait}-${index}`}
            nodeId={nodeId}
            trait={trait}
            index={index}
            label={label}
            chipClass={chipClass}
            selectedClass={selectedClass}
            onEdit={handleUpdateTrait}
            onRemove={handleRemoveTrait}
          />
        ))}
        {traits.length === 0 && (
          <span
            className={`rounded border border-dashed bg-white/70 px-2 py-1 text-[10px] ${emptyClass}`}
          >
            No {label.toLowerCase()} traits yet.
          </span>
        )}
      </div>
      {isAddingNew && (
        <div className="mt-2 flex items-center gap-2">
          <input
            value={draftValue}
            onChange={handleDraftChange}
            onKeyDown={onTraitInputKeyDown}
            placeholder={`Add ${label.toLowerCase()} trait`}
            className="flex-1 rounded border border-gray-300 bg-gray-50 px-2 py-1 text-[10px] leading-snug text-gray-800 outline-none focus:border-gray-500 focus:bg-white focus:ring-1 focus:ring-gray-400"
          />
          <button
            type="button"
            onClick={handleAddTrait}
            className="flex cursor-pointer items-center justify-center rounded-full bg-white text-green-500 hover:text-green-700"
            aria-label={`Confirm ${label} trait`}
          >
            <TbCheck size={12} />
          </button>
        </div>
      )}
    </section>
  );
}
