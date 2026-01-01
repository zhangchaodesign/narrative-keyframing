"use client";

import { TbCheck, TbPencil } from "react-icons/tb";
import { cn } from "@/lib/utiils/sharedUtils";

type NarrativeNodeMenuProps = {
  isEditing?: boolean;
  onToggleEdit?: () => void;
  wrapperClassName?: string;
  buttonPadding?: string;
  iconSize?: number;
};

export function NarrativeNodeMenu({
  isEditing = false,
  onToggleEdit,
  wrapperClassName = "flex items-center gap-1",
  buttonPadding = "p-1",
  iconSize = 12,
}: NarrativeNodeMenuProps) {
  return (
    <div className={cn(wrapperClassName)}>
      <button
        type="button"
        onClick={onToggleEdit}
        className={cn(
          "pointer-events-auto rounded-full transition hover:bg-purple-50 hover:text-purple-600 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-purple-500 disabled:cursor-not-allowed disabled:opacity-60",
          buttonPadding,
        )}
        title={isEditing ? "Save narration" : "Edit narration text"}
        aria-label={isEditing ? "Save narration" : "Edit narration text"}
      >
        {isEditing ? <TbCheck size={iconSize} /> : <TbPencil size={iconSize} />}
      </button>
    </div>
  );
}
