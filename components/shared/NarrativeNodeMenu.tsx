"use client";

import { useCallback } from "react";
import { TbCheck, TbPencil } from "react-icons/tb";
import { cn } from "@/lib/utiils/sharedUtils";
import { eventTracker } from "@/lib/utils";

type NarrativeNodeMenuProps = {
  nodeId?: string;
  narrativeText?: string;
  isEditing?: boolean;
  onToggleEdit?: () => void;
  wrapperClassName?: string;
  buttonPadding?: string;
  iconSize?: number;
};

export function NarrativeNodeMenu({
  nodeId,
  narrativeText,
  isEditing = false,
  onToggleEdit,
  wrapperClassName = "flex items-center gap-1",
  buttonPadding = "p-1",
  iconSize = 12,
}: NarrativeNodeMenuProps) {
  const handleToggleEdit = useCallback(() => {
    eventTracker({
      action: isEditing ? "save_narrative_edit" : "start_narrative_edit",
      data: {
        nodeId: nodeId,
        narrativeText: narrativeText,
      },
    });
    onToggleEdit?.();
  }, [isEditing, onToggleEdit, nodeId, narrativeText]);

  return (
    <div className={cn(wrapperClassName)}>
      <button
        type="button"
        onClick={handleToggleEdit}
        className={cn(
          "pointer-events-auto rounded-full transition hover:bg-purple-50 hover:text-purple-600 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-purple-500 disabled:cursor-not-allowed disabled:opacity-60",
          buttonPadding,
        )}
        disabled={!isEditing && !narrativeText?.trim()}
        title={isEditing ? "Save narration" : "Edit narration text"}
        aria-label={isEditing ? "Save narration" : "Edit narration text"}
      >
        {isEditing ? <TbCheck size={iconSize} /> : <TbPencil size={iconSize} />}
      </button>
    </div>
  );
}
