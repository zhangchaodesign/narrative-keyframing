"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type FocusEvent,
} from "react";
import { TbX } from "react-icons/tb";
import { cn } from "@/lib/utiils/sharedUtils";
import {
  buildEvidenceAttributeKey,
  useWorkflowStore,
} from "@/lib/stores/workflowStore";
import type {
  CharacterTraits,
  CharacterNodeType,
  PerspectiveNodeType,
} from "@/lib/types/workflow";

type TraitCategory = keyof CharacterTraits;

interface TraitItemProps {
  nodeId: string;
  category: TraitCategory;
  trait: string;
  index: number;
  label: string;
  sizeVariant?: "default" | "character-node";
  chipClass: string;
  selectedClass: string;
  onEdit: (index: number, newValue: string) => void;
  onRemove: (index: number) => void;
}

export function TraitItem({
  nodeId,
  category,
  trait,
  index,
  label,
  sizeVariant = "default",
  chipClass,
  selectedClass,
  onEdit,
  onRemove,
}: TraitItemProps) {
  const isCharacterNodeVariant = sizeVariant === "character-node";
  const [draftValue, setDraftValue] = useState(trait);

  // Keep local draft in sync when parent trait list changes (e.g. delete/reorder).
  useEffect(() => {
    setDraftValue(trait);
  }, [trait]);

  const selectedEvidenceAttributes = useWorkflowStore(
    (state) => state.selectedEvidenceAttributes,
  );
  const toggleEvidenceAttribute = useWorkflowStore(
    (state) => state.toggleEvidenceAttribute,
  );
  const workflowNodes = useWorkflowStore((state) => state.nodes);

  const attributeKey = buildEvidenceAttributeKey(nodeId, trait);
  const isSelected = Boolean(selectedEvidenceAttributes[attributeKey]);

  const characterName = useMemo(() => {
    const characterNode = workflowNodes.find(
      (node): node is CharacterNodeType =>
        node.id === nodeId && node.type === "character",
    );
    return characterNode?.data?.name ?? "";
  }, [workflowNodes, nodeId]);

  // Calculate evidence count for this trait from all perspective nodes in the same group
  const evidenceCount = useMemo(() => {
    if (!workflowNodes || workflowNodes.length === 0) {
      return 0;
    }

    const characterNode = workflowNodes.find(
      (node): node is CharacterNodeType =>
        node.id === nodeId && node.type === "character",
    );
    if (!characterNode) {
      return 0;
    }

    const parentId = characterNode.parentId;
    if (!parentId) {
      return 0;
    }

    const perspectiveNodes = workflowNodes.filter(
      (node): node is PerspectiveNodeType =>
        node.type === "perspective" &&
        node.parentId === parentId &&
        Boolean(node.data?.analysisEvidence),
    );

    if (perspectiveNodes.length === 0) {
      return 0;
    }

    const normalizedTrait = trait.trim().toLowerCase();
    let totalCount = 0;

    for (const perspectiveNode of perspectiveNodes) {
      const characterEvidence = perspectiveNode.data.analysisEvidence?.find(
        (evidence) => evidence.characterId === nodeId,
      );

      if (characterEvidence) {
        const count = characterEvidence.items.filter((item) =>
          item.attributes.some(
            (attr) => attr.trim().toLowerCase() === normalizedTrait,
          ),
        ).length;
        totalCount += count;
      }
    }

    return totalCount;
  }, [workflowNodes, nodeId, trait]);

  const handleToggleHighlight = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();
      const willBeSelected = !isSelected;

      toggleEvidenceAttribute(nodeId, trait);
    },
    [
      category,
      characterName,
      nodeId,
      trait,
      toggleEvidenceAttribute,
      isSelected,
      evidenceCount,
    ],
  );

  const handleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const nextValue = event.target.value;
      setDraftValue(nextValue);
      const trimmed = nextValue.trim();
      if (trimmed) {
        onEdit(index, trimmed);
      }
    },
    [index, onEdit],
  );

  const handleFocus = useCallback(
    (_event: FocusEvent<HTMLInputElement>) => {},
    [nodeId, characterName, category, draftValue, evidenceCount],
  );

  const handleBlur = useCallback(
    (event: FocusEvent<HTMLInputElement>) => {
      const trimmed = event.target.value.trim();
      if (!trimmed) {
        setDraftValue(trait);
      }
    },
    [nodeId, characterName, category, trait, evidenceCount],
  );

  const handleRemove = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();
      onRemove(index);
    },
    [index, onRemove],
  );

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={handleToggleHighlight}
        aria-pressed={isSelected}
        title={
          isSelected
            ? "Hide supporting evidence highlight"
            : "Highlight supporting evidence in perspectives"
        }
        className="shrink-0 cursor-pointer flex items-center justify-center self-center"
      >
        <span
          className={cn(
            "inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border text-[8px] font-bold transition-colors",
            isSelected
              ? "border-gray-500 bg-gray-500 text-white"
              : "border-gray-400 bg-transparent",
          )}
        >
          {isSelected && evidenceCount > 0 ? evidenceCount : ""}
        </span>
      </button>
      <div
        className={cn(
          "group/trait relative flex flex-1 items-center rounded border transition focus-within:border-gray-400 focus-within:ring-1 focus-within:ring-gray-300 focus-within:bg-white",
          isCharacterNodeVariant ? "text-[10px]" : "text-xs",
          chipClass,
          isSelected && selectedClass,
        )}
      >
        <input
          value={draftValue}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              (event.target as HTMLInputElement).blur();
            }
          }}
          onPointerDown={(event) => event.stopPropagation()}
          className="flex-1 min-w-0 bg-transparent px-2 py-1 pr-6 font-medium leading-snug text-inherit outline-none placeholder:text-gray-400 nodrag nopan"
          aria-label={`${label} trait`}
        />
        <div className="absolute right-1 top-1/2 z-10 -translate-y-1/2 hidden items-center group-hover/trait:flex group-focus-within/trait:flex">
          <button
            onClick={handleRemove}
            className={cn(
              "pointer-events-auto rounded p-0.5 cursor-pointer",
              isSelected
                ? "text-white hover:text-red-200"
                : "text-gray-400 hover:text-red-500",
            )}
            title="Remove attribute"
            aria-label={`Remove ${label} trait`}
          >
            <TbX size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}
