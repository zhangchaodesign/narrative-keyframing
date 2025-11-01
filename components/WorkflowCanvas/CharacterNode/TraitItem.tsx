"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";
import { TbCheck, TbPencil, TbX } from "react-icons/tb";
import { cn } from "@/lib/utils";
import {
  buildEvidenceAttributeKey,
  useWorkflowStore,
} from "@/lib/stores/workflowStore";

interface TraitItemProps {
  nodeId: string;
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

  const attributeKey = buildEvidenceAttributeKey(nodeId, trait);
  const isSelected = Boolean(selectedEvidenceAttributes[attributeKey]);

  const handleToggleHighlight = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();
      toggleEvidenceAttribute(nodeId, trait);
    },
    [nodeId, trait, toggleEvidenceAttribute],
  );

  const handleStartEdit = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();
      setIsEditing(true);
      setEditValue(trait);
    },
    [trait],
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
      setIsEditing(false);
      setEditValue(trait);
    },
    [trait],
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
        "group/trait relative flex items-center rounded border text-[10px] transition",
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
          className="flex-1 rounded border border-zinc-300 bg-white/80 px-2 py-1 text-[10px] leading-snug text-zinc-800 outline-none focus:border-zinc-500 focus:bg-white focus:ring-1 focus:ring-zinc-400"
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
          className="flex-1 px-2 py-1 pr-10 text-left font-medium leading-snug"
        >
          {trait}
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
                "pointer-events-auto rounded p-0.5 text-zinc-600 hover:text-zinc-800 cursor-pointer",
                isSelected && "text-white hover:text-white",
              )}
              title="Edit attribute"
              aria-label={`Edit ${label} trait`}
            >
              <TbPencil size={12} />
            </button>
            <button
              onClick={handleRemove}
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
}
