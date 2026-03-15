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
import { TbCheck, TbPencil, TbX } from "react-icons/tb";
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
import { eventTracker } from "@/lib/utils";

type TraitCategory = keyof CharacterTraits;

interface TraitItemProps {
  nodeId: string;
  category: TraitCategory;
  trait: string;
  index: number;
  label: string;
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
  chipClass,
  selectedClass,
  onEdit,
  onRemove,
}: TraitItemProps) {
  const editingInputRef = useRef<HTMLInputElement | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(trait);

  const selectedEvidenceAttributes = useWorkflowStore(
    (state) => state.selectedEvidenceAttributes,
  );
  const toggleEvidenceAttribute = useWorkflowStore(
    (state) => state.toggleEvidenceAttribute,
  );
  const workflowNodes = useWorkflowStore((state) => state.nodes);

  const attributeKey = buildEvidenceAttributeKey(nodeId, trait);
  const isSelected = Boolean(selectedEvidenceAttributes[attributeKey]);

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

      eventTracker({
        action: willBeSelected ? "highlight_trait_evidence" : "unhighlight_trait_evidence",
        data: {
          nodeId: nodeId,
          category: category,
          traitValue: trait,
          evidenceCount: evidenceCount,
        },
      });

      toggleEvidenceAttribute(nodeId, trait);
    },
    [category, nodeId, trait, toggleEvidenceAttribute, isSelected, evidenceCount],
  );

  const handleStartEdit = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();

      eventTracker({
        action: "start_edit_trait",
        data: {
          nodeId: nodeId,
          category: category,
          traitValue: trait,
          evidenceCount: evidenceCount,
        },
      });

      setIsEditing(true);
      setEditValue(trait);
    },
    [category, trait, nodeId, evidenceCount],
  );

  const handleEditChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setEditValue(event.target.value);
    },
    [],
  );

  const handleEditConfirm = useCallback(
    (event?: React.MouseEvent) => {
      event?.stopPropagation();
      const trimmed = editValue.trim();
      if (!trimmed) {
        return;
      }
      onEdit(index, trimmed);
      setIsEditing(false);
    },
    [editValue, index, onEdit],
  );

  const handleEditCancel = useCallback(
    (event?: React.MouseEvent) => {
      event?.stopPropagation();

      eventTracker({
        action: "cancel_edit_trait",
        data: {
          nodeId: nodeId,
          category: category,
          traitValue: trait,
          editedValue: editValue,
        },
      });

      setIsEditing(false);
      setEditValue(trait);
    },
    [category, trait, nodeId, editValue],
  );

  const handleRemove = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();
      onRemove(index);
    },
    [index, onRemove],
  );

  const onKeyDown = useCallback(
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

  useEffect(() => {
    if (isEditing) {
      editingInputRef.current?.focus();
      editingInputRef.current?.select();
    }
  }, [isEditing]);

  return (
    <div
      className={cn(
        "group/trait relative flex items-center rounded border text-xs transition",
        chipClass,
        isSelected && selectedClass,
      )}
    >
      {isEditing ? (
        <input
          ref={editingInputRef}
          value={editValue}
          onChange={handleEditChange}
          onKeyDown={onKeyDown}
          onPointerDown={(event) => event.stopPropagation()}
          className="flex-1 rounded border border-gray-300 bg-white/80 px-2 py-1 text-xs leading-snug text-gray-800 outline-none focus:border-gray-500 focus:bg-white focus:ring-1 focus:ring-gray-400 nodrag nopan"
          aria-label={`Edit ${label} trait`}
        />
      ) : (
        <button
          type="button"
          onClick={handleToggleHighlight}
          aria-pressed={isSelected}
          title={
            isSelected
              ? "Hide supporting evidence highlight"
              : "Highlight supporting evidence in perspectives"
          }
          className="flex-1 px-2 py-1 pr-10 text-left font-medium leading-snug overflow-x-auto overflow-y-hidden max-h-8 hide-scrollbar"
        >
          <span className="inline-flex items-center gap-1 whitespace-nowrap">
            <span>{trait}</span>
            {evidenceCount > 0 && (
              <span
                className={cn(
                  "inline-flex h-3.5 min-w-3.5 items-center justify-center rounded-full px-1 text-[8px] font-bold",
                  isSelected
                    ? "bg-white/20 text-white"
                    : "bg-gray-800/10 text-gray-700",
                )}
                title={`${evidenceCount} evidence item${
                  evidenceCount !== 1 ? "s" : ""
                } found`}
              >
                {evidenceCount}
              </span>
            )}
          </span>
        </button>
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
              onClick={handleStartEdit}
              className={cn(
                "pointer-events-auto rounded p-0.5 text-white hover:text-gray-200 cursor-pointer",
              )}
              title="Edit attribute"
              aria-label={`Edit ${label} trait`}
            >
              <TbPencil size={12} />
            </button>
            <button
              onClick={handleRemove}
              className="pointer-events-auto rounded p-0.5 text-white hover:text-gray-200 cursor-pointer"
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
}
