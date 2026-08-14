"use client";

import { useCallback, type ChangeEvent, type FocusEvent } from "react";
import { Position, type NodeProps, useReactFlow } from "@xyflow/react";
import { EventHandle } from "@/components/WorkflowCanvas/EventNode/EventHandle";
import type {
  EventNodeType,
  WorkflowEdge,
  WorkflowNode,
} from "@/lib/types/workflow";
import { cn } from "@/lib/utiils/sharedUtils";
import { geistMono } from "@/app/fonts";

export function EventNode({ id, data }: NodeProps<EventNodeType>) {
  const { setNodes } = useReactFlow<WorkflowNode, WorkflowEdge>();

  const handleDescriptionChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => {
      const updatedDescription = event.target.value;
      setNodes(
        (nodes) =>
          nodes.map((node) =>
            node.id === id && node.type === "event"
              ? {
                  ...node,
                  data: {
                    ...node.data,
                    description: updatedDescription,
                  },
                }
              : node,
          ) as WorkflowNode[],
      );
    },
    [id, setNodes],
  );

  const handleFocus = useCallback(
    (_event: FocusEvent<HTMLTextAreaElement>) => {},
    [id, data?.timeline, data?.description],
  );

  const handleBlur = useCallback(
    (event: FocusEvent<HTMLTextAreaElement>) => {},
    [id, data?.timeline],
  );

  return (
    <div className="group relative w-64 rounded-lg border-2 border-gray-500 bg-white p-3 text-xs hover:shadow-lg">
      <div
        className={cn(
          geistMono.className,
          "text-[10px] font-semibold uppercase tracking-wide text-gray-800",
        )}
      >
        📜 {data.timeline}
      </div>
      <textarea
        value={data?.description ?? ""}
        onChange={handleDescriptionChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder="Describe the event..."
        rows={4}
        onPointerDown={(event) => {
          event.stopPropagation();
        }}
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
        className="mt-2 w-full resize-none rounded border border-gray-300 bg-white/70 px-2 py-1 text-[10px] leading-snug text-gray-800 outline-none focus:border-gray-500 focus:bg-white focus:ring-1 focus:ring-gray-400 nodrag nopan"
      />
      <EventHandle type="target" position={Position.Left} id="event-prev" />
      <EventHandle type="source" position={Position.Right} id="event-next" />
    </div>
  );
}
