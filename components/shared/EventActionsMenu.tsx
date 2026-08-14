"use client";

import { useCallback } from "react";
import { TbEraser } from "react-icons/tb";
import { useWorkflowStore } from "@/lib/stores/workflowStore";
import { cn } from "@/lib/utiils/sharedUtils";

type EventActionsMenuProps = {
  eventGroupId: string;
  buttonPadding?: string;
  iconSize?: number;
  className?: string;
};

export function EventActionsMenu({
  eventGroupId,
  buttonPadding = "p-1",
  iconSize = 14,
  className,
}: EventActionsMenuProps) {
  const nodes = useWorkflowStore((state) => state.nodes);
  const setNodes = useWorkflowStore((state) => state.setNodes);

  const handleClear = useCallback(() => {
    const childEvents = nodes.filter(
      (node) => node.parentId === eventGroupId && node.type === "event",
    );

    setNodes((prev) =>
      prev.map((node) => {
        if (node.parentId === eventGroupId && node.type === "event") {
          return { ...node, data: { ...node.data, description: "" } };
        }
        return node;
      }),
    );
  }, [nodes, eventGroupId, setNodes]);

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <button
        type="button"
        onClick={handleClear}
        className={cn(
          "rounded-full transition text-gray-500 hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-indigo-500 cursor-pointer",
          buttonPadding,
        )}
        title="Clear all event descriptions"
        aria-label="Clear all event descriptions"
      >
        <TbEraser size={iconSize} />
      </button>
    </div>
  );
}
