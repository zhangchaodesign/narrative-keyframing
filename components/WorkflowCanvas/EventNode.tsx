"use client";

import { useCallback, type ChangeEvent } from "react";
import { Position, type NodeProps, useReactFlow } from "@xyflow/react";
import { CustomHandle } from "./CustomHandle";
import type { EventNodeType } from "./workflow.constants";

export function EventNode({ id, data }: NodeProps<EventNodeType>) {
  const { setNodes } = useReactFlow();

  const handleDescriptionChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => {
      const updatedDescription = event.target.value;
      setNodes((nodes) =>
        nodes.map((node) =>
          node.id === id
            ? {
                ...node,
                data: {
                  ...node.data,
                  description: updatedDescription,
                },
              }
            : node,
        ),
      );
    },
    [id, setNodes],
  );

  return (
    <div className="w-56 rounded-lg border border-slate-500 bg-white p-3 text-xs shadow-sm">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        {data?.timeline}
      </div>
      <textarea
        value={data?.description ?? ""}
        onChange={handleDescriptionChange}
        placeholder="Describe the event..."
        rows={4}
        className="mt-2 w-full resize-none rounded border border-slate-300 bg-slate-50 px-2 py-1 text-[11px] leading-snug text-slate-700 outline-none focus:border-slate-500 focus:bg-white focus:ring-1 focus:ring-slate-400"
      />
      <CustomHandle type="target" position={Position.Left} id="event-prev" />
      <CustomHandle type="source" position={Position.Right} id="event-next" />
      <CustomHandle type="source" position={Position.Bottom} id="narration" />
    </div>
  );
}
