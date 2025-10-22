"use client";

import { Position, type NodeProps } from "@xyflow/react";
import { CustomHandle } from "./CustomHandle";
import { NarrationHandle } from "./NarrationHandle";
import type { NarrationNodeType } from "./workflow.constants";

export function NarrationNode({ data }: NodeProps<NarrationNodeType>) {
  return (
    <div className="relative flex h-44 w-56 flex-col rounded-md border-2 border-indigo-400 bg-white p-3 text-xs hover:shadow-lg">
      <div className="flex justify-between w-full">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-800">
          💬 Narration
        </div>
        <div className="text-[10px] font-semibold tracking-wide text-indigo-500">
          {data?.narrator}
        </div>
      </div>
      <div className="mt-2 flex-1 overflow-y-auto rounded border border-indigo-100 bg-white/70 p-2 text-[10px] leading-snug text-indigo-900">
        {data?.reflection}
      </div>
      <NarrationHandle
        type="target"
        position={Position.Left}
        id="narration-prev"
      />
      <NarrationHandle
        type="source"
        position={Position.Right}
        id="narration-next"
      />
      <CustomHandle type="target" position={Position.Top} id="event" />
      <CustomHandle type="target" position={Position.Bottom} id="character" />
    </div>
  );
}
